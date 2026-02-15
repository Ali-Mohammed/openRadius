#!/bin/bash
# ============================================================================
# EdgeRuntime - FreeRADIUS Authentication Test
# Tests RADIUS auth against the local FreeRADIUS server
# ============================================================================

set -euo pipefail

RADIUS_HOST="${1:-127.0.0.1}"
RADIUS_SECRET="${2:-testing123}"

echo "============================================"
echo "  EdgeRuntime - RADIUS Auth Test"
echo "  Server: $RADIUS_HOST"
echo "============================================"

# Check if radtest is available
if ! command -v radtest &> /dev/null; then
    echo "❌ radtest not found. Install freeradius-utils:"
    echo "   macOS:  brew install freeradius-server"
    echo "   Linux:  apt install freeradius-utils"
    exit 1
fi

echo ""
echo "[1] Testing with a CDC-synced user (if available)..."
echo "    Querying PostgreSQL for a test user..."

TEST_USER=$(docker exec ${COMPOSE_PROJECT_NAME:-edge}_postgres psql -U postgres -d edge_db -t -c \
    "SELECT \"Username\" FROM \"RadiusUsers\" WHERE \"Enabled\" = true AND \"Password\" IS NOT NULL LIMIT 1;" 2>/dev/null | tr -d ' ')

if [ -n "$TEST_USER" ]; then
    TEST_PASS=$(docker exec ${COMPOSE_PROJECT_NAME:-edge}_postgres psql -U postgres -d edge_db -t -c \
        "SELECT \"Password\" FROM \"RadiusUsers\" WHERE \"Username\" = '$TEST_USER';" 2>/dev/null | tr -d ' ')
    
    echo "    Found user: $TEST_USER"
    echo "    Running radtest..."
    radtest "$TEST_USER" "$TEST_PASS" "$RADIUS_HOST" 0 "$RADIUS_SECRET" && echo "    ✓ Access-Accept" || echo "    ✗ Access-Reject"
else
    echo "    ⚠ No CDC-synced users found in database"
fi

echo ""
echo "[2] Testing with a non-existent user (should reject)..."
radtest "nonexistent_user_test" "wrongpass" "$RADIUS_HOST" 0 "$RADIUS_SECRET" && echo "    ✗ Unexpected Access-Accept!" || echo "    ✓ Access-Reject (expected)"

echo ""
echo "Done! Check FreeRADIUS logs for details:"
echo "  docker logs ${COMPOSE_PROJECT_NAME:-edge}_freeradius --tail 50"
