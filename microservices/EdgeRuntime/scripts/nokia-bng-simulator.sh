#!/usr/bin/env bash
# ============================================================================
# Nokia 7750 SR BNG/BRAS Simulator for EdgeRuntime
# Simulates a realistic Nokia (Alcatel-Lucent) 7750 SR / 7450 ESS BNG
# sending RADIUS Auth + Accounting to FreeRADIUS
#
# Compatible with bash 3.2+ (macOS default)
#
# Features:
#   - Realistic Nokia IPoE/PPPoE subscriber model
#   - Multiple BNG nodes (NAS devices)
#   - Progressive traffic accumulation
#   - Random subscriber churn (connects/disconnects)
#   - Interim-Update intervals matching real BNG behavior
#   - Nokia SROS-style Acct-Session-Id (hex)
#   - Gigaword wrapping for heavy users
#   - Auth before Start (real BNG flow)
#   - Live dashboard with session table
#
# Usage:
#   ./nokia-bng-simulator.sh                    # Default: 20 subs, 5s cycle
#   ./nokia-bng-simulator.sh --subscribers 50   # 50 subscribers
#   ./nokia-bng-simulator.sh --fast             # Stress: 1s cycle, 30s interim
#   ./nokia-bng-simulator.sh --gentle           # Gentle: 10s cycle, 10 subs
#   ./nokia-bng-simulator.sh --headless         # No TUI, just log lines
#   ./nokia-bng-simulator.sh --help
# ============================================================================

# ============================================================================
# Configuration
# ============================================================================

# BNG identity
BNG_IP_1="10.10.10.1"
BNG_IP_2="10.10.20.1"
BNG_IP_3="10.10.30.1"
BNG_NAME_1="BNG-CORE-01"
BNG_NAME_2="BNG-CORE-02"
BNG_NAME_3="BNG-AGGR-01"
BNG_MAC_1="AA:BB:CC:01:00:01"
BNG_MAC_2="AA:BB:CC:02:00:01"
BNG_MAC_3="AA:BB:CC:03:00:01"
BNG_COUNT=3

# Defaults
MAX_SUBSCRIBERS=20
CYCLE_INTERVAL=5
INTERIM_INTERVAL=300
CONNECT_CHANCE=15
DISCONNECT_CHANCE=3
HEADLESS=false

# Traffic profiles: dl_min dl_max ul_min ul_max (bytes per interim)
# 0=residential-basic 1=residential-premium 2=business-fiber 3=gaming-ultra 4=iptv
PROF_DL_MIN_0=100000;    PROF_DL_MAX_0=5000000;    PROF_UL_MIN_0=10000;    PROF_UL_MAX_0=500000
PROF_DL_MIN_1=500000;    PROF_DL_MAX_1=20000000;   PROF_UL_MIN_1=50000;    PROF_UL_MAX_1=5000000
PROF_DL_MIN_2=1000000;   PROF_DL_MAX_2=50000000;   PROF_UL_MIN_2=200000;   PROF_UL_MAX_2=10000000
PROF_DL_MIN_3=2000000;   PROF_DL_MAX_3=100000000;  PROF_UL_MIN_3=500000;   PROF_UL_MAX_3=20000000
PROF_DL_MIN_4=5000000;   PROF_DL_MAX_4=200000000;  PROF_UL_MIN_4=100000;   PROF_UL_MAX_4=2000000
PROF_NAME_0="residential-basic"
PROF_NAME_1="residential-premium"
PROF_NAME_2="business-fiber"
PROF_NAME_3="gaming-ultra"
PROF_NAME_4="iptv-multicast"
PROF_COUNT=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ============================================================================
# Argument parsing
# ============================================================================

while [ $# -gt 0 ]; do
    case "$1" in
        --subscribers) MAX_SUBSCRIBERS="$2"; shift 2 ;;
        --cycle)       CYCLE_INTERVAL="$2"; shift 2 ;;
        --interim)     INTERIM_INTERVAL="$2"; shift 2 ;;
        --bng-count)   BNG_COUNT="$2"; shift 2 ;;
        --fast)
            CYCLE_INTERVAL=1; INTERIM_INTERVAL=30; MAX_SUBSCRIBERS=50
            CONNECT_CHANCE=30; DISCONNECT_CHANCE=2; shift ;;
        --gentle)
            CYCLE_INTERVAL=10; INTERIM_INTERVAL=300; MAX_SUBSCRIBERS=10
            CONNECT_CHANCE=10; DISCONNECT_CHANCE=2; shift ;;
        --headless)    HEADLESS=true; shift ;;
        --help)
            echo "Nokia 7750 SR BNG Simulator"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "  --subscribers N    Max concurrent (default: 20)"
            echo "  --cycle N          Cycle interval seconds (default: 5)"
            echo "  --interim N        Interim interval seconds (default: 300)"
            echo "  --fast             Stress: 1s cycle, 30s interim, 50 subs"
            echo "  --gentle           Gentle: 10s cycle, 300s interim, 10 subs"
            echo "  --headless         No TUI, just log output"
            echo "  --help             Show this help"
            exit 0 ;;
        *) echo "Unknown: $1"; exit 1 ;;
    esac
done

INTERIM_CYCLE_COUNT=$((INTERIM_INTERVAL / CYCLE_INTERVAL))
[ "$INTERIM_CYCLE_COUNT" -lt 1 ] && INTERIM_CYCLE_COUNT=1

# ============================================================================
# State management (file-based for bash 3 compat)
# ============================================================================

STATE_DIR=$(mktemp -d)
trap 'cleanup_exit' EXIT INT TERM

# Stats
STAT_STARTS=0
STAT_INTERIMS=0
STAT_STOPS=0
STAT_ERRORS=0
STAT_CYCLES=0
STAT_TOTAL_DL=0
STAT_TOTAL_UL=0
SIM_START=$(date +%s)

cleanup_exit() {
    echo ""
    if ! $HEADLESS; then
        echo -e "${YELLOW}Shutting down Nokia BNG Simulator...${NC}"
    fi
    echo ""
    echo "═══════════════════════════════════════"
    echo "  Nokia BNG Simulator — Final Report"
    echo "═══════════════════════════════════════"
    local now; now=$(date +%s)
    local runtime=$((now - SIM_START))
    echo "  Runtime:   $(format_duration $runtime)"
    echo "  Cycles:    $STAT_CYCLES"
    echo "  Starts:    $STAT_STARTS"
    echo "  Interims:  $STAT_INTERIMS"
    echo "  Stops:     $STAT_STOPS"
    echo "  Errors:    $STAT_ERRORS"
    echo "  Total DL:  $(format_bytes_hr $STAT_TOTAL_DL)"
    echo "  Total UL:  $(format_bytes_hr $STAT_TOTAL_UL)"
    echo "═══════════════════════════════════════"
    rm -rf "$STATE_DIR" 2>/dev/null || true
    exit 0
}

# Session file format: username|password|session_id|nas_idx|nas_port|framed_ip|mac|profile_idx|start_ts|session_time|total_dl|total_ul|cycle_count

get_bng_ip()   { eval echo "\$BNG_IP_$1"; }
get_bng_name() { eval echo "\$BNG_NAME_$1"; }
get_bng_mac()  { eval echo "\$BNG_MAC_$1"; }
get_prof_name(){ eval echo "\$PROF_NAME_$1"; }
get_prof_dl_min(){ eval echo "\$PROF_DL_MIN_$1"; }
get_prof_dl_max(){ eval echo "\$PROF_DL_MAX_$1"; }
get_prof_ul_min(){ eval echo "\$PROF_UL_MIN_$1"; }
get_prof_ul_max(){ eval echo "\$PROF_UL_MAX_$1"; }

# Parse pipe-delimited session line into positional variables
# Usage: parse_session "$line"  → sets S_USER S_PASS S_SID S_NAS S_PORT S_IP S_MAC S_PROF S_START S_TIME S_DL S_UL S_CYCLE
parse_session() {
    local IFS='|'
    set -- $1
    S_USER="$1"; S_PASS="$2"; S_SID="$3"; S_NAS="$4"; S_PORT="$5"
    S_IP="$6"; S_MAC="$7"; S_PROF="$8"; S_START="$9"; shift 9
    S_TIME="$1"; S_DL="$2"; S_UL="$3"; S_CYCLE="$4"
}

count_active() {
    local c=0
    for f in "$STATE_DIR"/session_*; do
        [ -f "$f" ] && c=$((c + 1))
    done
    echo $c
}

is_active() { [ -f "$STATE_DIR/session_$1" ]; }

# ============================================================================
# Formatting
# ============================================================================

format_bytes_hr() {
    local b=$1
    if [ "$b" -ge 1073741824 ] 2>/dev/null; then
        echo "$(awk "BEGIN{printf \"%.1f\", $b/1073741824}") GB"
    elif [ "$b" -ge 1048576 ] 2>/dev/null; then
        echo "$(awk "BEGIN{printf \"%.1f\", $b/1048576}") MB"
    elif [ "$b" -ge 1024 ] 2>/dev/null; then
        echo "$(awk "BEGIN{printf \"%.1f\", $b/1024}") KB"
    else
        echo "${b} B"
    fi
}

format_duration() {
    local s=$1
    printf "%02d:%02d:%02d" $((s/3600)) $(( (s%3600)/60 )) $((s%60))
}

log_event() {
    local level="$1"; shift
    local msg="$*"
    if $HEADLESS; then
        echo "[$(date '+%H:%M:%S')] [$level] $msg"
    fi
}

# ============================================================================
# RADIUS sending (via docker compose exec)
# ============================================================================

send_acct() {
    local attrs="$1"
    local result
    result=$(echo "$attrs" | docker compose exec -T freeradius radclient 127.0.0.1:1813 acct testing123 2>&1) || true

    if echo "$result" | grep -q "Received Accounting-Response"; then
        return 0
    else
        STAT_ERRORS=$((STAT_ERRORS + 1))
        log_event "ERROR" "Acct failed: $(echo "$result" | head -1)"
        return 1
    fi
}

send_auth() {
    local username="$1"
    local password="$2"

    local result
    result=$(printf 'User-Name = "%s"\nUser-Password = "%s"\n' "$username" "$password" | docker compose exec -T freeradius radclient 127.0.0.1:1812 auth testing123 2>&1) || true

    if echo "$result" | grep -q "Access-Accept"; then
        return 0
    else
        log_event "WARN" "Auth reject: $username"
        return 1
    fi
}

# ============================================================================
# Session lifecycle
# ============================================================================

do_connect() {
    local username="$1"
    local password="$2"

    # Step 1: Authenticate (like a real BNG)
    if ! send_auth "$username" "$password"; then
        log_event "WARN" "Skipping $username — auth rejected"
        return 1
    fi

    # Generate session parameters
    local nas_idx=$((RANDOM % BNG_COUNT))
    local nas_port=$((RANDOM % 65536))
    local ip_c=$((RANDOM % 254 + 1))
    local ip_b=$((RANDOM % 254 + 1))
    local framed_ip="172.16.${ip_c}.${ip_b}"
    local mac
    mac=$(printf "%02X:%02X:%02X:%02X:%02X:%02X" $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
    local profile_idx=$((RANDOM % PROF_COUNT))
    local now; now=$(date +%s)
    local session_id
    session_id=$(printf "%04X%04X%04X%04X" $((RANDOM)) $((RANDOM)) $((RANDOM)) $((RANDOM)))

    # Save session state
    echo "${username}|${password}|${session_id}|${nas_idx}|${nas_port}|${framed_ip}|${mac}|${profile_idx}|${now}|0|0|0|0" \
        > "$STATE_DIR/session_${username}"

    # Step 2: Send Accounting Start
    local nas_ip; nas_ip=$(get_bng_ip "$nas_idx")
    local nas_mac; nas_mac=$(get_bng_mac "$nas_idx")
    local nas_name; nas_name=$(get_bng_name "$nas_idx")

    local attrs="Acct-Status-Type = Start
Acct-Session-Id = \"${session_id}\"
User-Name = \"${username}\"
NAS-IP-Address = ${nas_ip}
Framed-IP-Address = ${framed_ip}
NAS-Port = ${nas_port}
NAS-Port-Type = Ethernet
Called-Station-Id = \"${nas_mac}\"
Calling-Station-Id = \"${mac}\"
Service-Type = Framed-User
Framed-Protocol = PPP
Acct-Interim-Interval = ${INTERIM_INTERVAL}
NAS-Identifier = \"${nas_name}\"
Acct-Authentic = RADIUS"

    if send_acct "$attrs"; then
        STAT_STARTS=$((STAT_STARTS + 1))
        log_event "START" "$username session=$session_id nas=$nas_name ip=$framed_ip profile=$(get_prof_name $profile_idx)"
        return 0
    fi
    rm -f "$STATE_DIR/session_${username}" 2>/dev/null
    return 1
}

do_interim() {
    local username="$1"
    local file="$STATE_DIR/session_${username}"
    [ -f "$file" ] || return 1

    local line; line=$(cat "$file")
    parse_session "$line"

    local nas_ip; nas_ip=$(get_bng_ip "$S_NAS")
    local nas_mac; nas_mac=$(get_bng_mac "$S_NAS")
    local nas_name; nas_name=$(get_bng_name "$S_NAS")

    # Generate traffic delta
    local dl_min; dl_min=$(get_prof_dl_min "$S_PROF")
    local dl_max; dl_max=$(get_prof_dl_max "$S_PROF")
    local ul_min; ul_min=$(get_prof_ul_min "$S_PROF")
    local ul_max; ul_max=$(get_prof_ul_max "$S_PROF")

    local dl_range=$((dl_max - dl_min + 1))
    local ul_range=$((ul_max - ul_min + 1))
    local dl_delta=$(( (RANDOM % dl_range) + dl_min ))
    local ul_delta=$(( (RANDOM % ul_range) + ul_min ))

    local new_dl=$((S_DL + dl_delta))
    local new_ul=$((S_UL + ul_delta))
    local new_time=$((S_TIME + INTERIM_INTERVAL))
    local new_cycle=$((S_CYCLE + 1))

    # Gigaword wrapping (Nokia does this at 2^32)
    local GIGA=4294967296
    local dl_giga=$((new_dl / GIGA))
    local dl_octets=$((new_dl % GIGA))
    local ul_giga=$((new_ul / GIGA))
    local ul_octets=$((new_ul % GIGA))

    local attrs="Acct-Status-Type = Interim-Update
Acct-Session-Id = \"${S_SID}\"
User-Name = \"${S_USER}\"
NAS-IP-Address = ${nas_ip}
Framed-IP-Address = ${S_IP}
NAS-Port = ${S_PORT}
NAS-Port-Type = Ethernet
Called-Station-Id = \"${nas_mac}\"
Calling-Station-Id = \"${S_MAC}\"
Service-Type = Framed-User
Framed-Protocol = PPP
Acct-Interim-Interval = ${INTERIM_INTERVAL}
NAS-Identifier = \"${nas_name}\"
Acct-Session-Time = ${new_time}
Acct-Input-Octets = ${dl_octets}
Acct-Output-Octets = ${ul_octets}
Acct-Input-Gigawords = ${dl_giga}
Acct-Output-Gigawords = ${ul_giga}
Acct-Authentic = RADIUS"

    if send_acct "$attrs"; then
        echo "${S_USER}|${S_PASS}|${S_SID}|${S_NAS}|${S_PORT}|${S_IP}|${S_MAC}|${S_PROF}|${S_START}|${new_time}|${new_dl}|${new_ul}|${new_cycle}" \
            > "$file"
        STAT_INTERIMS=$((STAT_INTERIMS + 1))
        STAT_TOTAL_DL=$((STAT_TOTAL_DL + dl_delta))
        STAT_TOTAL_UL=$((STAT_TOTAL_UL + ul_delta))
        log_event "INTERIM" "$username time=${new_time}s dl=$(format_bytes_hr $new_dl) ul=$(format_bytes_hr $new_ul)"
        return 0
    fi
    return 1
}

do_disconnect() {
    local username="$1"
    local cause="${2:-User-Request}"
    local file="$STATE_DIR/session_${username}"
    [ -f "$file" ] || return 1

    local line; line=$(cat "$file")
    parse_session "$line"

    local nas_ip; nas_ip=$(get_bng_ip "$S_NAS")

    local GIGA=4294967296
    local dl_giga=$((S_DL / GIGA))
    local dl_octets=$((S_DL % GIGA))
    local ul_giga=$((S_UL / GIGA))
    local ul_octets=$((S_UL % GIGA))

    local attrs="Acct-Status-Type = Stop
Acct-Session-Id = \"${S_SID}\"
User-Name = \"${S_USER}\"
NAS-IP-Address = ${nas_ip}
Framed-IP-Address = ${S_IP}
NAS-Port = ${S_PORT}
Acct-Terminate-Cause = ${cause}
Acct-Session-Time = ${S_TIME}
Acct-Input-Octets = ${dl_octets}
Acct-Output-Octets = ${ul_octets}
Acct-Input-Gigawords = ${dl_giga}
Acct-Output-Gigawords = ${ul_giga}
Acct-Authentic = RADIUS"

    if send_acct "$attrs"; then
        rm -f "$file"
        STAT_STOPS=$((STAT_STOPS + 1))
        log_event "STOP" "$username cause=$cause time=${S_TIME}s dl=$(format_bytes_hr $S_DL) ul=$(format_bytes_hr $S_UL)"
        return 0
    fi
    return 1
}

# ============================================================================
# Subscriber pool
# ============================================================================

USERS_FILE="$STATE_DIR/users"

load_subscribers() {
    echo -e "${CYAN}Loading subscriber pool from PostgreSQL...${NC}"

    local result
    result=$(docker compose exec -T postgres psql -U postgres -d edge_db -t -A -c \
        "SELECT \"Username\" || '|' || \"Password\" FROM \"RadiusUsers\" WHERE \"Enabled\"=true AND \"IsDeleted\"=false AND \"Password\" IS NOT NULL ORDER BY random() LIMIT ${MAX_SUBSCRIBERS};" 2>&1) || true

    if [ -z "$result" ] || echo "$result" | grep -qi "error"; then
        echo -e "${YELLOW}DB unavailable — using generated subscribers${NC}"
        local i=1
        while [ $i -le "$MAX_SUBSCRIBERS" ]; do
            printf "sim_user_%03d|simpass\n" $i >> "$USERS_FILE"
            i=$((i + 1))
        done
    else
        echo "$result" > "$USERS_FILE"
    fi

    USER_COUNT=$(wc -l < "$USERS_FILE" | tr -d ' ')
    echo -e "${GREEN}Loaded ${USER_COUNT} subscribers${NC}"
}

get_random_subscriber() {
    local idx=$((RANDOM % USER_COUNT + 1))
    sed -n "${idx}p" "$USERS_FILE"
}

# ============================================================================
# TUI Dashboard
# ============================================================================

draw_dashboard() {
    local active; active=$(count_active)
    local now; now=$(date +%s)
    local runtime=$((now - SIM_START))

    # Clear screen
    printf '\033[2J\033[H'

    echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║             Nokia 7750 SR BNG Simulator — EdgeRuntime                ║${NC}"
    echo -e "${BOLD}${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    printf "${CYAN}║${NC}  BNG Nodes: ${BOLD}%d${NC}  │  Sub Pool: ${BOLD}%d${NC}  │  Cycle: ${BOLD}%ds${NC}  │  Interim: ${BOLD}%ds${NC}         ${CYAN}║${NC}\n" \
        "$BNG_COUNT" "$USER_COUNT" "$CYCLE_INTERVAL" "$INTERIM_INTERVAL"
    printf "${CYAN}║${NC}  Runtime: ${BOLD}%s${NC}  │  Cycle: ${BOLD}%d${NC}  │  Active Sessions: ${BOLD}${GREEN}%d${NC}                     ${CYAN}║${NC}\n" \
        "$(format_duration $runtime)" "$STAT_CYCLES" "$active"
    echo -e "${BOLD}${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${NC}"
    printf "${CYAN}║${NC}  ${GREEN}▲ Start:${NC} %-6d  │  ${YELLOW}↻ Interim:${NC} %-6d  │  ${RED}■ Stop:${NC} %-6d  │  ${RED}✗${NC} Err: %-4d ${CYAN}║${NC}\n" \
        "$STAT_STARTS" "$STAT_INTERIMS" "$STAT_STOPS" "$STAT_ERRORS"
    printf "${CYAN}║${NC}  ${CYAN}↓ Total DL:${NC} %-14s  │  ${CYAN}↑ Total UL:${NC} %-14s                ${CYAN}║${NC}\n" \
        "$(format_bytes_hr $STAT_TOTAL_DL)" "$(format_bytes_hr $STAT_TOTAL_UL)"
    echo -e "${BOLD}${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${NC}"

    # Active sessions table
    printf "${CYAN}║${NC}  ${BOLD}%-16s %-16s %-14s %9s %10s %10s${NC}  ${CYAN}║${NC}\n" \
        "Username" "Framed-IP" "NAS" "Time" "Download" "Upload"
    echo -e "${CYAN}║${NC}  ──────────────── ──────────────── ────────────── ───────── ────────── ──────────  ${CYAN}║${NC}"

    local printed=0
    for session_file in "$STATE_DIR"/session_*; do
        [ -f "$session_file" ] || continue
        local line; line=$(cat "$session_file")
        parse_session "$line"

        local nas_name; nas_name=$(get_bng_name "$S_NAS")

        printf "${CYAN}║${NC}  ${GREEN}●${NC} %-14s %-16s %-14s %9s %10s %10s  ${CYAN}║${NC}\n" \
            "$S_USER" "$S_IP" "$nas_name" \
            "$(format_duration $S_TIME)" \
            "$(format_bytes_hr $S_DL)" \
            "$(format_bytes_hr $S_UL)"

        printed=$((printed + 1))
        if [ $printed -ge 20 ]; then
            local remaining=$((active - printed))
            if [ $remaining -gt 0 ]; then
                printf "${CYAN}║${NC}  ${DIM}... and %d more sessions${NC}%*s${CYAN}║${NC}\n" \
                    "$remaining" 44 ""
            fi
            break
        fi
    done

    if [ "$active" = "0" ]; then
        echo -e "${CYAN}║${NC}  ${DIM}(waiting for subscribers to connect...)${NC}                                ${CYAN}║${NC}"
    fi

    echo -e "${BOLD}${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${NC}"

    # NAS distribution
    printf "${CYAN}║${NC}  ${BOLD}NAS:${NC} "
    local i=0
    while [ $i -lt "$BNG_COUNT" ]; do
        local bng_sessions=0
        for sf in "$STATE_DIR"/session_*; do
            [ -f "$sf" ] || continue
            local ni
            ni=$(cut -d'|' -f4 < "$sf")
            [ "$ni" = "$i" ] && bng_sessions=$((bng_sessions + 1))
        done
        printf "%s=%d  " "$(get_bng_name $i)" "$bng_sessions"
        i=$((i + 1))
    done
    echo -e "       ${CYAN}║${NC}"

    echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "${DIM}  Press Ctrl+C to stop${NC}"
}

# ============================================================================
# Simulation cycle
# ============================================================================

run_cycle() {
    STAT_CYCLES=$((STAT_CYCLES + 1))
    local active; active=$(count_active)

    # --- Phase 1: New connections ---
    if [ "$active" -lt "$MAX_SUBSCRIBERS" ]; then
        local roll=$((RANDOM % 100))
        if [ $roll -lt $CONNECT_CHANCE ]; then
            local attempts=0
            while [ $attempts -lt 5 ]; do
                local sub_line; sub_line=$(get_random_subscriber)
                local sub_user; sub_user=$(echo "$sub_line" | cut -d'|' -f1)
                local sub_pass; sub_pass=$(echo "$sub_line" | cut -d'|' -f2)

                if [ -n "$sub_user" ] && ! is_active "$sub_user"; then
                    do_connect "$sub_user" "$sub_pass"
                    break
                fi
                attempts=$((attempts + 1))
            done
        fi
    fi

    # --- Phase 2: Interim updates ---
    for session_file in "$STATE_DIR"/session_*; do
        [ -f "$session_file" ] || continue
        local line; line=$(cat "$session_file")
        parse_session "$line"

        local new_cycle=$((S_CYCLE + 1))

        if [ $((new_cycle % INTERIM_CYCLE_COUNT)) -eq 0 ] && [ "$new_cycle" -gt 0 ]; then
            do_interim "$S_USER"
        else
            # Just bump cycle counter
            echo "${S_USER}|${S_PASS}|${S_SID}|${S_NAS}|${S_PORT}|${S_IP}|${S_MAC}|${S_PROF}|${S_START}|${S_TIME}|${S_DL}|${S_UL}|${new_cycle}" \
                > "$session_file"
        fi
    done

    # --- Phase 3: Random disconnections ---
    for session_file in "$STATE_DIR"/session_*; do
        [ -f "$session_file" ] || continue
        local line; line=$(cat "$session_file")
        parse_session "$line"

        # Don't disconnect sessions younger than 2 interims
        if [ "$S_TIME" -lt $((INTERIM_INTERVAL * 2)) ]; then
            continue
        fi

        local roll=$((RANDOM % 100))
        if [ $roll -lt $DISCONNECT_CHANCE ]; then
            local cause_roll=$((RANDOM % 6))
            local cause="User-Request"
            case $cause_roll in
                0) cause="User-Request" ;;
                1) cause="Lost-Carrier" ;;
                2) cause="Idle-Timeout" ;;
                3) cause="Session-Timeout" ;;
                4) cause="Port-Error" ;;
                5) cause="Admin-Reset" ;;
            esac
            do_disconnect "$S_USER" "$cause"
        fi
    done
}

# ============================================================================
# Main
# ============================================================================

echo -e "${BOLD}${CYAN}Nokia 7750 SR BNG Simulator — Starting${NC}"

# Verify FreeRADIUS is running
COMPOSE_DIR="/Users/amohammed/Desktop/CodeMe/openRadius/microservices/EdgeRuntime"
cd "$COMPOSE_DIR"

if ! docker compose ps freeradius 2>&1 | grep -q "Up"; then
    echo -e "${RED}ERROR: FreeRADIUS container is not running!${NC}"
    echo "Run: cd $COMPOSE_DIR && docker compose up -d"
    exit 1
fi

load_subscribers

echo -e "${GREEN}Simulator ready. Starting in 2s...${NC}"
sleep 2

while true; do
    run_cycle

    if ! $HEADLESS; then
        draw_dashboard
    fi

    sleep "$CYCLE_INTERVAL"
done
