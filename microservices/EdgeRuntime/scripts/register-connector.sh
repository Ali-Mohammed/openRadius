#!/bin/bash
# ============================================================================
# EdgeRuntime - Register JDBC Sink Connector
# Registers the CDC sink connector with Kafka Connect
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/jdbc-sink-connector.json"
CONNECT_URL="${CONNECT_URL:-http://localhost:8084}"

echo "============================================"
echo "  EdgeRuntime - Register JDBC Sink Connector"
echo "============================================"

# Wait for Kafka Connect to be ready
echo "[1/3] Waiting for Kafka Connect to be ready..."
until curl -sf "$CONNECT_URL/" > /dev/null 2>&1; do
    echo "  Kafka Connect not ready, waiting 5s..."
    sleep 5
done
echo "  ✓ Kafka Connect is ready!"

# Check if connector already exists
echo ""
echo "[2/3] Checking existing connectors..."
EXISTING=$(curl -sf "$CONNECT_URL/connectors" 2>/dev/null || echo "[]")
echo "  Current connectors: $EXISTING"

CONNECTOR_NAME=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['name'])" 2>/dev/null || echo "unknown")
if echo "$EXISTING" | grep -q "$CONNECTOR_NAME"; then
    echo "  ⚠ Connector '$CONNECTOR_NAME' already exists."
    echo ""
    echo "  Current status:"
    curl -sf "$CONNECT_URL/connectors/$CONNECTOR_NAME/status" | python3 -m json.tool 2>/dev/null || true
    echo ""
    read -p "  Delete and recreate? (y/N): " -r REPLY
    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
        curl -sf -X DELETE "$CONNECT_URL/connectors/$CONNECTOR_NAME" > /dev/null
        echo "  ✓ Deleted existing connector"
        sleep 3
    else
        echo "  Skipping registration."
        exit 0
    fi
fi

# Register the connector
echo ""
echo "[3/3] Registering connector from $CONFIG_FILE..."
RESPONSE=$(curl -sf -X POST "$CONNECT_URL/connectors" \
    -H "Content-Type: application/json" \
    -d @"$CONFIG_FILE" 2>&1)

echo "  ✓ Registration complete!"
echo ""

# Check status
sleep 5
echo "Connector status:"
curl -sf "$CONNECT_URL/connectors/$CONNECTOR_NAME/status" | python3 -m json.tool 2>/dev/null || echo "  Could not fetch status"
echo ""
echo "Done!"
