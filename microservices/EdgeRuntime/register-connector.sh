#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/jdbc-sink-connector.json"

# Wait for Kafka Connect to be ready
echo "Waiting for Kafka Connect to be ready..."
until curl -s http://localhost:8084/ > /dev/null; do
  echo "Kafka Connect is not ready yet, waiting..."
  sleep 5
done

echo "Kafka Connect is ready!"

# Check if connector already exists
if curl -s http://localhost:8084/connectors | grep -q "jdbc-sink-connector"; then
  echo "Connector 'jdbc-sink-connector' already exists. Skipping registration."
  exit 0
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Configuration file not found at $CONFIG_FILE"
  exit 1
fi

# Register the JDBC Sink Connector
echo "Registering JDBC Sink Connector from $CONFIG_FILE..."
curl -X POST http://localhost:8084/connectors \
  -H "Content-Type: application/json" \
  -d @"$CONFIG_FILE"

echo ""
echo "Connector registration complete!"

# Check status
sleep 5
curl -s http://localhost:8084/connectors/jdbc-sink-connector/status | jq
