#!/bin/bash
# ============================================================================
# EdgeRuntime - Heavy FreeRADIUS Load Test
# Real-world simulation: multiple users, concurrent sessions, varied traffic
#
# Architecture: RADIUS → linelog (JSON) → Fluent Bit → ClickHouse (sole dest)
#
# Simulates:
#   - Multiple subscriber users with realistic session lifecycles
#   - Concurrent sessions across multiple NAS devices
#   - Varied session durations (short browsing → long streaming)
#   - Multiple interim updates with growing traffic counters
#   - Proper start → interim(s) → stop lifecycle per session
#   - Accounting-On / Accounting-Off NAS events
#   - Data verification & analytics queries against ClickHouse
#
# Usage:
#   ./scripts/test-heavy-load.sh [options]
#   Options:
#     -u, --users      Number of users         (default: 10)
#     -s, --sessions   Sessions per user        (default: 3)
#     -i, --interims   Interim updates/session  (default: 2)
#     -h, --host       RADIUS host              (default: 127.0.0.1)
#     -k, --secret     RADIUS shared secret     (default: testing123)
#     -w, --wait       Fluent Bit flush wait    (default: 15)
#     -p, --parallel   Max parallel radclient   (default: 5)
#         --help       Show this help
# ============================================================================

set -euo pipefail

# ─────────────────── Defaults ───────────────────
NUM_USERS=10
SESSIONS_PER_USER=3
INTERIMS_PER_SESSION=2
RADIUS_HOST="127.0.0.1"
RADIUS_SECRET="testing123"
FLUSH_WAIT=15
MAX_PARALLEL=5
PROJECT="${COMPOSE_PROJECT_NAME:-edge}"
RUN_ID="heavy-$(date +%s)"

# ─────────────────── Parse Args ───────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--users)     NUM_USERS="$2"; shift 2 ;;
        -s|--sessions)  SESSIONS_PER_USER="$2"; shift 2 ;;
        -i|--interims)  INTERIMS_PER_SESSION="$2"; shift 2 ;;
        -h|--host)      RADIUS_HOST="$2"; shift 2 ;;
        -k|--secret)    RADIUS_SECRET="$2"; shift 2 ;;
        -w|--wait)      FLUSH_WAIT="$2"; shift 2 ;;
        -p|--parallel)  MAX_PARALLEL="$2"; shift 2 ;;
        --help)
            sed -n '2,/^# ====/{ /^# ====/d; s/^# //; s/^#//; p; }' "$0"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

TOTAL_SESSIONS=$((NUM_USERS * SESSIONS_PER_USER))
TOTAL_INTERIMS=$((TOTAL_SESSIONS * INTERIMS_PER_SESSION))
TOTAL_EVENTS=$((TOTAL_SESSIONS * (2 + INTERIMS_PER_SESSION) + 2))  # start+stop per session + interims + on/off

# ─────────────────── Docker Mode (macOS UDP fix) ───────────────────
# macOS Docker Desktop doesn't forward UDP reliably.
# Auto-detect and run radclient inside the freeradius container.
USE_DOCKER="${USE_DOCKER:-auto}"
if [[ "$USE_DOCKER" == "auto" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
        USE_DOCKER="yes"
    else
        USE_DOCKER="no"
    fi
fi

# ─────────────────── NAS Pool ───────────────────
NAS_IPS=("192.168.1.1" "192.168.1.2" "192.168.2.1" "10.0.0.1" "172.16.0.1")
NAS_NAMES=("nas-core-01" "nas-core-02" "nas-branch-01" "nas-dc-01" "nas-edge-01")
NAS_COUNT=${#NAS_IPS[@]}

# ─────────────────── Traffic Profiles ───────────────────
# Simulates real subscriber patterns: (base_download, base_upload, session_seconds)
PROFILES=(
    "524288:131072:120"       # Light browsing: 512KB/128KB, 2 min
    "2097152:524288:300"      # Normal browsing: 2MB/512KB, 5 min
    "10485760:1048576:900"    # Video streaming: 10MB/1MB, 15 min
    "52428800:5242880:1800"   # Heavy download: 50MB/5MB, 30 min
    "104857600:10485760:3600" # Gaming/torrent: 100MB/10MB, 60 min
    "1048576:1048576:600"     # Symmetric upload: 1MB/1MB, 10 min
)
PROFILE_COUNT=${#PROFILES[@]}

# ─────────────────── MAC Generator ───────────────────
random_mac() {
    printf '%02X:%02X:%02X:%02X:%02X:%02X' \
        $((RANDOM % 256)) $((RANDOM % 256)) $((RANDOM % 256)) \
        $((RANDOM % 256)) $((RANDOM % 256)) $((RANDOM % 256))
}

random_ip() {
    echo "10.$((RANDOM % 256)).$((RANDOM % 256)).$((RANDOM % 256 + 1))"
}

# ─────────────────── Parallel Job Control ───────────────────
JOB_COUNT=0
wait_for_slot() {
    while (( JOB_COUNT >= MAX_PARALLEL )); do
        wait -n 2>/dev/null || true
        JOB_COUNT=$((JOB_COUNT - 1))
    done
}

# ─────────────────── Counters ───────────────────
SENT_START=0
SENT_INTERIM=0
SENT_STOP=0
FAILED=0
TMPDIR_RUN=$(mktemp -d)
trap "rm -rf $TMPDIR_RUN" EXIT

# ─────────────────── Send Packet (background) ───────────────────
send_packet() {
    local packet_data="$1"
    local label="$2"
    local result
    if [[ "$USE_DOCKER" == "yes" ]]; then
        result=$(echo "$packet_data" | docker exec -i "${PROJECT}_freeradius" radclient -r 3 -t 5 "$RADIUS_HOST:1813" acct "$RADIUS_SECRET" 2>&1)
    else
        result=$(echo "$packet_data" | radclient -r 3 -t 5 "$RADIUS_HOST:1813" acct "$RADIUS_SECRET" 2>&1)
    fi
    if [[ $? -eq 0 ]]; then
        touch "$TMPDIR_RUN/ok_${label}_$$_$RANDOM"
    else
        touch "$TMPDIR_RUN/fail_${label}_$$_$RANDOM"
    fi
}

# ─────────────────── Banner ───────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          EdgeRuntime - Heavy FreeRADIUS Load Test             ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Run ID:        $RUN_ID"
echo "║  RADIUS Host:   $RADIUS_HOST"
echo "║  Users:         $NUM_USERS"
echo "║  Sessions/user: $SESSIONS_PER_USER"
echo "║  Interims/sess: $INTERIMS_PER_SESSION"
echo "║  Total sessions: $TOTAL_SESSIONS"
echo "║  Total events:  ~$TOTAL_EVENTS (start+interim+stop+on/off)"
echo "║  Max parallel:  $MAX_PARALLEL"
echo "║  NAS devices:   $NAS_COUNT"
echo "║  Destination:   ClickHouse (insert-only, append-only)"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────── Pre-flight ───────────────────
echo "━━━ Pre-flight checks ━━━"

if [[ "$USE_DOCKER" == "yes" ]]; then
    echo "  ℹ Mode: Docker (radclient runs inside ${PROJECT}_freeradius)"
    if ! docker ps --format '{{.Names}}' | grep -q "${PROJECT}_freeradius"; then
        echo "  ❌ ${PROJECT}_freeradius container not running"
        exit 1
    fi
    echo "  ✓ FreeRADIUS container is running"
else
    if ! command -v radclient &> /dev/null; then
        echo "  ❌ radclient not found. Install freeradius-utils:"
        echo "     macOS:  brew install freeradius-server"
        echo "     Linux:  apt install freeradius-utils"
        exit 1
    fi
    echo "  ✓ radclient available"
fi

# Check FreeRADIUS container logs for readiness
if docker logs "${PROJECT}_freeradius" 2>&1 | tail -5 | grep -q "Ready to process"; then
    echo "  ✓ FreeRADIUS is ready to process requests"
else
    echo "  ⚠ FreeRADIUS may not be ready (check logs)"
fi

# Check ClickHouse is up
CH_HEALTH=$(docker exec "${PROJECT}_clickhouse" clickhouse-client \
    --database radius_analytics \
    --query "SELECT 1 FORMAT TabSeparated" 2>/dev/null || echo "0")
if [[ "$CH_HEALTH" == "1" ]]; then
    echo "  ✓ ClickHouse is healthy"
else
    echo "  ❌ ClickHouse is not responding"
    exit 1
fi

# Get pre-test counts
PRE_COUNT=$(docker exec "${PROJECT}_clickhouse" clickhouse-client \
    --database radius_analytics \
    --query "SELECT count() FROM radius_accounting FORMAT TabSeparated" 2>/dev/null || echo "0")
echo "  ℹ Pre-test ClickHouse rows: $PRE_COUNT"
RUN_START_TS=$(date +%s)
echo ""

# ═════════════════════════════════════════════════
# Phase 1: NAS Accounting-On (NAS boot notification)
# ═════════════════════════════════════════════════
echo "━━━ Phase 1: NAS Accounting-On ━━━"
for ((n=0; n<NAS_COUNT; n++)); do
    nas_ip="${NAS_IPS[$n]}"
    echo "  Sending Accounting-On from NAS $nas_ip..."
    on_pkt="Acct-Status-Type = Accounting-On
NAS-IP-Address = $nas_ip
Acct-Session-Id = ${RUN_ID}-on-${n}
Acct-Terminate-Cause = NAS-Reboot"
    if [[ "$USE_DOCKER" == "yes" ]]; then
        echo "$on_pkt" | docker exec -i "${PROJECT}_freeradius" radclient -r 3 -t 5 "$RADIUS_HOST:1813" acct "$RADIUS_SECRET" > /dev/null 2>&1 && echo "    ✓ On" || echo "    ✗ Failed"
    else
        echo "$on_pkt" | radclient -r 3 -t 5 "$RADIUS_HOST:1813" acct "$RADIUS_SECRET" > /dev/null 2>&1 && echo "    ✓ On" || echo "    ✗ Failed"
    fi
done
echo ""

# ═════════════════════════════════════════════════
# Phase 2: User Sessions (Start → Interim(s) → Stop)
# ═════════════════════════════════════════════════
echo "━━━ Phase 2: User Sessions ($TOTAL_SESSIONS total) ━━━"
START_TIME=$(date +%s)

for ((u=1; u<=NUM_USERS; u++)); do
    username="subscriber_${u}"
    echo "  User $u/$NUM_USERS: $username ($SESSIONS_PER_USER sessions)"
    
    for ((s=1; s<=SESSIONS_PER_USER; s++)); do
        # Pick random NAS, profile, IPs
        nas_idx=$((RANDOM % NAS_COUNT))
        nas_ip="${NAS_IPS[$nas_idx]}"
        profile_idx=$((RANDOM % PROFILE_COUNT))
        IFS=':' read -r base_down base_up session_time <<< "${PROFILES[$profile_idx]}"
        
        session_id="${RUN_ID}-u${u}-s${s}"
        framed_ip=$(random_ip)
        calling_mac=$(random_mac)
        called_mac=$(random_mac)
        nas_port=$((RANDOM % 65535 + 1))
        
        # ── Start ──
        wait_for_slot
        send_packet "Acct-Session-Id = $session_id
Acct-Status-Type = Start
User-Name = $username
NAS-IP-Address = $nas_ip
NAS-Port = $nas_port
NAS-Port-Type = Ethernet
Framed-IP-Address = $framed_ip
Called-Station-Id = $called_mac
Calling-Station-Id = $calling_mac
Acct-Authentic = RADIUS
Service-Type = Framed-User
Framed-Protocol = PPP" "start" &
        JOB_COUNT=$((JOB_COUNT + 1))
        
        # Small delay between start and first interim
        sleep 0.1
        
        # ── Interim Updates ──
        for ((i=1; i<=INTERIMS_PER_SESSION; i++)); do
            # Traffic grows with each interim (realistic accumulation)
            elapsed=$(( (session_time * i) / (INTERIMS_PER_SESSION + 1) ))
            cur_down=$(( (base_down * i) / INTERIMS_PER_SESSION ))
            cur_up=$(( (base_up * i) / INTERIMS_PER_SESSION ))
            
            wait_for_slot
            send_packet "Acct-Session-Id = $session_id
Acct-Status-Type = Interim-Update
User-Name = $username
NAS-IP-Address = $nas_ip
NAS-Port = $nas_port
Acct-Session-Time = $elapsed
Acct-Input-Octets = $cur_down
Acct-Output-Octets = $cur_up
Framed-IP-Address = $framed_ip
Called-Station-Id = $called_mac
Calling-Station-Id = $calling_mac" "interim" &
            JOB_COUNT=$((JOB_COUNT + 1))
            
            sleep 0.05
        done
        
        # ── Stop ──
        # Pick a realistic terminate cause
        CAUSES=("User-Request" "Idle-Timeout" "Session-Timeout" "Port-Error" "Lost-Carrier" "NAS-Reboot")
        term_cause="${CAUSES[$((RANDOM % ${#CAUSES[@]}))]}"
        
        wait_for_slot
        send_packet "Acct-Session-Id = $session_id
Acct-Status-Type = Stop
User-Name = $username
NAS-IP-Address = $nas_ip
NAS-Port = $nas_port
Acct-Session-Time = $session_time
Acct-Input-Octets = $base_down
Acct-Output-Octets = $base_up
Acct-Terminate-Cause = $term_cause
Framed-IP-Address = $framed_ip
Called-Station-Id = $called_mac
Calling-Station-Id = $calling_mac
Service-Type = Framed-User
Framed-Protocol = PPP" "stop" &
        JOB_COUNT=$((JOB_COUNT + 1))
        
        sleep 0.05
    done
done

# Wait for all background radclient processes
echo ""
echo "  Waiting for all packets to complete..."
wait

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Count results
SENT_START=$(find "$TMPDIR_RUN" -name "ok_start_*" 2>/dev/null | wc -l | tr -d ' ')
SENT_INTERIM=$(find "$TMPDIR_RUN" -name "ok_interim_*" 2>/dev/null | wc -l | tr -d ' ')
SENT_STOP=$(find "$TMPDIR_RUN" -name "ok_stop_*" 2>/dev/null | wc -l | tr -d ' ')
FAILED=$(find "$TMPDIR_RUN" -name "fail_*" 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "  ┌──────────────────────────────────┐"
echo "  │ Packet Summary                   │"
echo "  ├──────────────────────────────────┤"
echo "  │ Start:    $SENT_START sent"
echo "  │ Interim:  $SENT_INTERIM sent"
echo "  │ Stop:     $SENT_STOP sent"
echo "  │ Failed:   $FAILED"
echo "  │ Time:     ${ELAPSED}s"
echo "  │ Rate:     ~$(( (SENT_START + SENT_INTERIM + SENT_STOP) / (ELAPSED > 0 ? ELAPSED : 1) )) pkt/s"
echo "  └──────────────────────────────────┘"
echo ""

# ═════════════════════════════════════════════════
# Phase 3: NAS Accounting-Off
# ═════════════════════════════════════════════════
echo "━━━ Phase 3: NAS Accounting-Off ━━━"
for ((n=0; n<NAS_COUNT; n++)); do
    nas_ip="${NAS_IPS[$n]}"
    off_pkt="Acct-Status-Type = Accounting-Off
NAS-IP-Address = $nas_ip
Acct-Session-Id = ${RUN_ID}-off-${n}
Acct-Terminate-Cause = NAS-Reboot"
    if [[ "$USE_DOCKER" == "yes" ]]; then
        echo "$off_pkt" | docker exec -i "${PROJECT}_freeradius" radclient -r 3 -t 5 "$RADIUS_HOST:1813" acct "$RADIUS_SECRET" > /dev/null 2>&1 && echo "  ✓ Off from $nas_ip" || echo "  ✗ Failed from $nas_ip"
    else
        echo "$off_pkt" | radclient -r 3 -t 5 "$RADIUS_HOST:1813" acct "$RADIUS_SECRET" > /dev/null 2>&1 && echo "  ✓ Off from $nas_ip" || echo "  ✗ Failed from $nas_ip"
    fi
done
echo ""

# ═════════════════════════════════════════════════
# Phase 4: Wait for Fluent Bit flush → ClickHouse
# ═════════════════════════════════════════════════
echo "━━━ Phase 4: Waiting ${FLUSH_WAIT}s for Fluent Bit → ClickHouse pipeline ━━━"
for ((w=FLUSH_WAIT; w>0; w--)); do
    printf "\r  ⏳ %2d seconds remaining..." "$w"
    sleep 1
done
echo -e "\r  ✓ Flush wait complete                    "
echo ""

# ═════════════════════════════════════════════════
# Phase 5: ClickHouse Data Verification & Analytics
# ═════════════════════════════════════════════════
echo "━━━ Phase 5: ClickHouse Data Verification ━━━"

CH_CMD="docker exec ${PROJECT}_clickhouse clickhouse-client --database radius_analytics"

# 5.1 Total row count
POST_COUNT=$($CH_CMD --query "SELECT count() FROM radius_accounting FORMAT TabSeparated" 2>/dev/null || echo "0")
NEW_ROWS=$((POST_COUNT - PRE_COUNT))
echo ""
echo "  📊 Total rows: $POST_COUNT (new: $NEW_ROWS)"
echo ""

# 5.2 Events by type for this run
echo "  ── Events by Type (this run) ──"
$CH_CMD --query "
    SELECT
        event_type,
        count() AS event_count
    FROM radius_accounting
    WHERE acctsessionid LIKE '${RUN_ID}%'
    GROUP BY event_type
    ORDER BY event_type
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.3 Per-user summary
echo "  ── Per-User Session Summary (this run) ──"
$CH_CMD --query "
    SELECT
        username,
        countIf(event_type = 'start')   AS starts,
        countIf(event_type = 'interim') AS interims,
        countIf(event_type = 'stop')    AS stops,
        count()                          AS total_events,
        formatReadableSize(sum(acctinputoctets))   AS total_download,
        formatReadableSize(sum(acctoutputoctets))  AS total_upload,
        formatReadableTimeDelta(sum(acctsessiontime)) AS total_time
    FROM radius_accounting
    WHERE acctsessionid LIKE '${RUN_ID}%'
      AND event_type IN ('start', 'interim', 'stop')
    GROUP BY username
    ORDER BY username
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.4 Per-NAS summary
echo "  ── Per-NAS Device Summary (this run) ──"
$CH_CMD --query "
    SELECT
        nasipaddress,
        uniq(username)                   AS unique_users,
        countIf(event_type = 'start')    AS sessions,
        formatReadableSize(sum(acctinputoctets))   AS total_download,
        formatReadableSize(sum(acctoutputoctets))  AS total_upload
    FROM radius_accounting
    WHERE acctsessionid LIKE '${RUN_ID}%'
      AND event_type IN ('start', 'interim', 'stop')
    GROUP BY nasipaddress
    ORDER BY sessions DESC
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.5 Traffic distribution
echo "  ── Traffic Distribution by Session Size ──"
$CH_CMD --query "
    SELECT
        CASE
            WHEN total_bytes < 1048576                       THEN '< 1 MB'
            WHEN total_bytes >= 1048576    AND total_bytes < 10485760   THEN '1-10 MB'
            WHEN total_bytes >= 10485760   AND total_bytes < 104857600  THEN '10-100 MB'
            WHEN total_bytes >= 104857600  AND total_bytes < 1073741824 THEN '100 MB-1 GB'
            ELSE '> 1 GB'
        END AS traffic_bucket,
        count() AS session_count,
        formatReadableSize(sum(total_bytes)) AS total_traffic
    FROM (
        SELECT
            acctsessionid,
            max(acctinputoctets) + max(acctoutputoctets) AS total_bytes
        FROM radius_accounting
        WHERE acctsessionid LIKE '${RUN_ID}%'
          AND event_type = 'stop'
        GROUP BY acctsessionid
    )
    GROUP BY traffic_bucket
    ORDER BY traffic_bucket
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.6 Terminate cause breakdown
echo "  ── Session Terminate Causes ──"
$CH_CMD --query "
    SELECT
        acctterminatecause AS terminate_cause,
        count()            AS session_count
    FROM radius_accounting
    WHERE acctsessionid LIKE '${RUN_ID}%'
      AND event_type = 'stop'
    GROUP BY terminate_cause
    ORDER BY session_count DESC
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.7 Session lifecycle integrity
echo "  ── Session Lifecycle Integrity Check ──"
$CH_CMD --query "
    SELECT
        countDistinctIf(acctsessionid, event_type = 'start')   AS sessions_started,
        countDistinctIf(acctsessionid, event_type = 'stop')    AS sessions_stopped,
        countDistinctIf(acctsessionid, event_type = 'interim') AS sessions_with_interim,
        countDistinctIf(acctsessionid, event_type = 'start') -
            countDistinctIf(acctsessionid, event_type = 'stop') AS orphaned_sessions
    FROM radius_accounting
    WHERE acctsessionid LIKE '${RUN_ID}%'
      AND event_type IN ('start', 'interim', 'stop')
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.8 Sample raw events (first 5 sessions)
echo "  ── Sample Session Lifecycle (first 5 sessions) ──"
$CH_CMD --query "
    SELECT
        acctsessionid,
        username,
        event_type,
        toDateTime(event_timestamp) AS event_time,
        acctsessiontime             AS session_sec,
        formatReadableSize(acctinputoctets)  AS download,
        formatReadableSize(acctoutputoctets) AS upload,
        nasipaddress,
        framedipaddress
    FROM radius_accounting
    WHERE acctsessionid IN (
        SELECT DISTINCT acctsessionid
        FROM radius_accounting
        WHERE acctsessionid LIKE '${RUN_ID}%'
          AND event_type = 'start'
        LIMIT 5
    )
    ORDER BY acctsessionid, event_timestamp
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.9 Accounting-On/Off events
echo "  ── NAS Accounting-On/Off Events ──"
$CH_CMD --query "
    SELECT
        event_type,
        nasipaddress,
        toDateTime(event_timestamp) AS event_time,
        acctterminatecause
    FROM radius_accounting
    WHERE event_type IN ('on', 'off')
      AND event_timestamp >= $RUN_START_TS
    ORDER BY event_timestamp
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.10 Materialized view data (hourly traffic)
echo "  ── Materialized View: Hourly Traffic Aggregates ──"
$CH_CMD --query "
    SELECT
        event_hour,
        username,
        nasipaddress,
        formatReadableSize(sumMerge(total_input))  AS total_download,
        formatReadableSize(sumMerge(total_output)) AS total_upload,
        countMerge(session_count)                  AS sessions,
        formatReadableTimeDelta(sumMerge(total_time)) AS total_time
    FROM mv_hourly_traffic
    WHERE event_hour >= now() - INTERVAL 1 HOUR
    GROUP BY event_hour, username, nasipaddress
    ORDER BY event_hour DESC, total_download DESC
    LIMIT 20
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed (materialized view may be empty if no data flowed yet)"
echo ""

# 5.11 Daily NAS summary from materialized view
echo "  ── Materialized View: Daily NAS Summary ──"
$CH_CMD --query "
    SELECT
        event_date,
        nasipaddress,
        uniqMerge(unique_users)                    AS unique_users,
        countMerge(total_sessions)                 AS total_sessions,
        formatReadableSize(sumMerge(total_input))  AS total_download,
        formatReadableSize(sumMerge(total_output)) AS total_upload
    FROM mv_daily_nas_summary
    WHERE event_date >= today()
    GROUP BY event_date, nasipaddress
    ORDER BY total_sessions DESC
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.12 Active sessions view (should be 0 since we sent stops)
echo "  ── View: Active Sessions (should be 0 — all sessions stopped) ──"
ACTIVE=$($CH_CMD --query "SELECT count() FROM v_active_sessions FORMAT TabSeparated" 2>/dev/null || echo "?")
echo "    Active sessions: $ACTIVE"
echo ""

# 5.13 Top users view
echo "  ── View: Top Users (last 24h) ──"
$CH_CMD --query "
    SELECT * FROM v_top_users_24h
    LIMIT 15
    FORMAT PrettyCompact
" 2>/dev/null || echo "    ⚠ Query failed"
echo ""

# 5.14 Fluent Bit pipeline health
echo "  ── Fluent Bit Pipeline Health ──"
FB_METRICS=$(curl -sf "http://localhost:${FLUENT_BIT_METRICS_PORT:-2020}/api/v1/metrics" 2>/dev/null)
if [ -n "$FB_METRICS" ]; then
    echo "    ✓ Fluent Bit is running"
    # Extract key metrics
    FB_INPUT=$(echo "$FB_METRICS" | grep -o '"input_records_total":[0-9]*' 2>/dev/null | head -1 | cut -d: -f2 || true)
    FB_OUTPUT=$(echo "$FB_METRICS" | grep -o '"output_proc_records_total":[0-9]*' 2>/dev/null | head -1 | cut -d: -f2 || true)
    FB_ERRORS=$(echo "$FB_METRICS" | grep -o '"output_errors_total":[0-9]*' 2>/dev/null | head -1 | cut -d: -f2 || true)
    FB_RETRIES=$(echo "$FB_METRICS" | grep -o '"output_retries_total":[0-9]*' 2>/dev/null | head -1 | cut -d: -f2 || true)
    echo "    Input records:  ${FB_INPUT:-n/a}"
    echo "    Output records: ${FB_OUTPUT:-n/a}"
    echo "    Errors:         ${FB_ERRORS:-n/a}"
    echo "    Retries:        ${FB_RETRIES:-n/a}"
else
    echo "    ⚠ Could not reach Fluent Bit metrics endpoint"
fi
echo ""

# ═════════════════════════════════════════════════
# Phase 6: Validation Summary
# ═════════════════════════════════════════════════
EXPECTED_SESSIONS=$((SENT_START))
EXPECTED_STOPS=$((SENT_STOP))
CH_STARTS=$($CH_CMD --query "SELECT countIf(event_type='start') FROM radius_accounting WHERE acctsessionid LIKE '${RUN_ID}%' FORMAT TabSeparated" 2>/dev/null || echo "0")
CH_INTERIMS=$($CH_CMD --query "SELECT countIf(event_type='interim') FROM radius_accounting WHERE acctsessionid LIKE '${RUN_ID}%' FORMAT TabSeparated" 2>/dev/null || echo "0")
CH_STOPS=$($CH_CMD --query "SELECT countIf(event_type='stop') FROM radius_accounting WHERE acctsessionid LIKE '${RUN_ID}%' FORMAT TabSeparated" 2>/dev/null || echo "0")
CH_ON=$($CH_CMD --query "SELECT countIf(event_type='on') FROM radius_accounting WHERE event_type IN ('on','off') AND event_timestamp >= $RUN_START_TS FORMAT TabSeparated" 2>/dev/null || echo "0")
CH_OFF=$($CH_CMD --query "SELECT countIf(event_type='off') FROM radius_accounting WHERE event_type IN ('on','off') AND event_timestamp >= $RUN_START_TS FORMAT TabSeparated" 2>/dev/null || echo "0")

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Validation Summary                        ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  Event Type    │  Sent       │  ClickHouse  │  Status        ║"
echo "╠════════════════════════════════════════════════════════════════╣"
printf "║  Start         │  %-10s │  %-11s │  %s\n" "$SENT_START" "$CH_STARTS" "$( [[ "$SENT_START" -eq "$CH_STARTS" ]] && echo "✅ Match" || echo "⚠ Mismatch" )"
printf "║  Interim       │  %-10s │  %-11s │  %s\n" "$SENT_INTERIM" "$CH_INTERIMS" "$( [[ "$SENT_INTERIM" -eq "$CH_INTERIMS" ]] && echo "✅ Match" || echo "⚠ Mismatch" )"
printf "║  Stop          │  %-10s │  %-11s │  %s\n" "$SENT_STOP" "$CH_STOPS" "$( [[ "$SENT_STOP" -eq "$CH_STOPS" ]] && echo "✅ Match" || echo "⚠ Mismatch" )"
printf "║  Acct-On       │  %-10s │  %-11s │  %s\n" "$NAS_COUNT" "$CH_ON" "$( [[ "$NAS_COUNT" -eq "$CH_ON" ]] && echo "✅ Match" || echo "⚠ Mismatch" )"
printf "║  Acct-Off      │  %-10s │  %-11s │  %s\n" "$NAS_COUNT" "$CH_OFF" "$( [[ "$NAS_COUNT" -eq "$CH_OFF" ]] && echo "✅ Match" || echo "⚠ Mismatch" )"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

TOTAL_SENT=$((SENT_START + SENT_INTERIM + SENT_STOP + NAS_COUNT * 2))
TOTAL_CH=$((CH_STARTS + CH_INTERIMS + CH_STOPS + CH_ON + CH_OFF))

if [[ "$TOTAL_SENT" -eq "$TOTAL_CH" && "$FAILED" -eq 0 ]]; then
    echo "  ✅ ALL TESTS PASSED — $TOTAL_CH/$TOTAL_SENT events verified in ClickHouse"
elif [[ "$TOTAL_SENT" -eq "$TOTAL_CH" ]]; then
    echo "  ⚠ Events match ($TOTAL_CH/$TOTAL_SENT) but $FAILED packets failed to send"
else
    echo "  ⚠ MISMATCH: Sent $TOTAL_SENT events, ClickHouse has $TOTAL_CH"
    echo "    This may be a timing issue — try increasing --wait (currently ${FLUSH_WAIT}s)"
    echo "    Or check Fluent Bit logs: docker logs ${PROJECT}_fluent_bit --tail 30"
fi

echo ""
echo "  📋 Useful follow-up queries:"
echo "     # All data for this run:"
echo "     docker exec ${PROJECT}_clickhouse clickhouse-client -d radius_analytics \\"
echo "       -q \"SELECT * FROM radius_accounting WHERE acctsessionid LIKE '${RUN_ID}%' ORDER BY event_timestamp FORMAT PrettyCompact\""
echo ""
echo "     # Export to CSV:"
echo "     docker exec ${PROJECT}_clickhouse clickhouse-client -d radius_analytics \\"
echo "       -q \"SELECT * FROM radius_accounting WHERE acctsessionid LIKE '${RUN_ID}%' FORMAT CSVWithNames\" > accounting_export.csv"
echo ""
echo "━━━ Done! Run ID: $RUN_ID ━━━"
