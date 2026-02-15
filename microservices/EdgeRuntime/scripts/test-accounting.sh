#!/bin/bash
# ============================================================================
# EdgeRuntime - Accounting Test
# Sends test accounting packets and verifies data lands in ClickHouse
# (sole accounting destination — insert-only, append-only)
# ============================================================================

set -euo pipefail

RADIUS_HOST="${1:-127.0.0.1}"
RADIUS_SECRET="${2:-testing123}"
TEST_USER="${3:-test_acct_user}"
SESSION_ID="test-session-$(date +%s)"
PROJECT="${COMPOSE_PROJECT_NAME:-edge}"

echo "============================================"
echo "  EdgeRuntime - Accounting Pipeline Test"
echo "  Server: $RADIUS_HOST"
echo "  User:   $TEST_USER"
echo "  Session: $SESSION_ID"
echo "  Destination: ClickHouse (insert-only)"
echo "============================================"

if ! command -v radclient &> /dev/null; then
    echo "❌ radclient not found. Install freeradius-utils:"
    echo "   macOS:  brew install freeradius-server"
    echo "   Linux:  apt install freeradius-utils"
    exit 1
fi

# --- Accounting Start ---
echo ""
echo "[1/4] Sending Accounting-Start..."
echo "Acct-Session-Id = $SESSION_ID
Acct-Status-Type = Start
User-Name = $TEST_USER
NAS-IP-Address = 192.168.1.1
NAS-Port = 1
NAS-Port-Type = Ethernet
Framed-IP-Address = 10.0.0.100
Called-Station-Id = AA:BB:CC:DD:EE:FF
Calling-Station-Id = 11:22:33:44:55:66
Acct-Authentic = RADIUS
Service-Type = Framed-User
Framed-Protocol = PPP" | radclient -x "$RADIUS_HOST:1813" acct "$RADIUS_SECRET"
echo "  ✓ Start sent"

sleep 2

# --- Accounting Interim ---
echo ""
echo "[2/4] Sending Accounting-Interim-Update..."
echo "Acct-Session-Id = $SESSION_ID
Acct-Status-Type = Interim-Update
User-Name = $TEST_USER
NAS-IP-Address = 192.168.1.1
Acct-Session-Time = 300
Acct-Input-Octets = 1048576
Acct-Output-Octets = 5242880
Framed-IP-Address = 10.0.0.100" | radclient -x "$RADIUS_HOST:1813" acct "$RADIUS_SECRET"
echo "  ✓ Interim update sent"

sleep 2

# --- Accounting Stop ---
echo ""
echo "[3/4] Sending Accounting-Stop..."
echo "Acct-Session-Id = $SESSION_ID
Acct-Status-Type = Stop
User-Name = $TEST_USER
NAS-IP-Address = 192.168.1.1
Acct-Session-Time = 600
Acct-Input-Octets = 2097152
Acct-Output-Octets = 10485760
Acct-Terminate-Cause = User-Request
Framed-IP-Address = 10.0.0.100" | radclient -x "$RADIUS_HOST:1813" acct "$RADIUS_SECRET"
echo "  ✓ Stop sent"

# --- Verify ---
echo ""
echo "[4/4] Verifying ClickHouse data pipeline..."

echo ""
echo "  Waiting 10s for Fluent Bit to flush to ClickHouse..."
sleep 10

echo ""
echo "  ClickHouse (radius_accounting) — all 3 events should appear:"
docker exec "${PROJECT}_clickhouse" clickhouse-client \
    --database radius_analytics \
    --query "SELECT acctsessionid, username, event_type, toDateTime(event_timestamp) AS event_time, acctsessiontime, acctinputoctets, acctoutputoctets FROM radius_accounting WHERE acctsessionid = '$SESSION_ID' ORDER BY event_timestamp FORMAT Pretty;" 2>/dev/null || echo "  ⚠ Could not query ClickHouse"

echo ""
echo "  Event count:"
EVENT_COUNT=$(docker exec "${PROJECT}_clickhouse" clickhouse-client \
    --database radius_analytics \
    --query "SELECT count() FROM radius_accounting WHERE acctsessionid = '$SESSION_ID' FORMAT TabSeparated;" 2>/dev/null || echo "0")
echo "    Found $EVENT_COUNT events (expected: 3 — start, interim, stop)"

echo ""
echo "  Fluent Bit metrics:"
curl -sf "http://localhost:${FLUENT_BIT_METRICS_PORT:-2020}/api/v1/metrics" 2>/dev/null | head -20 || echo "  ⚠ Could not reach Fluent Bit metrics endpoint"

echo ""
echo "============================================"
echo "  Test Complete!"
echo "============================================"
