#!/bin/bash
# Nokia 7750 SR BNG Simulator — Run Script
# Builds the Go binary and runs it on the Docker network
#
# Usage:
#   ./run.sh                  # default: 500ms cycle, 30s interim, 40 subs
#   ./run.sh --turbo          # 200ms cycle, 15s interim, burst 40
#   ./run.sh --gentle         # 2s cycle, 60s interim, burst 10
#   ./run.sh --custom         # edit env vars below
#
# Press Ctrl+C for graceful shutdown (sends Acct-Stop for all sessions)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EDGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARY="$SCRIPT_DIR/nokia-bng-simulator-linux"
NETWORK="edge_edge-network"

# ── Defaults ──────────────────────────────────────────────────────────────
CYCLE_MS="${CYCLE_MS:-500}"
INTERIM="${INTERIM:-30}"
MAX_SUBS="${MAX_SUBS:-40}"
BURST="${BURST:-30}"
CONN_PER_CYC="${CONN_PER_CYC:-5}"
DISC_CHANCE="${DISC_CHANCE:-5}"
HEADLESS="${HEADLESS:-true}"

# ── Presets ───────────────────────────────────────────────────────────────
case "${1:-}" in
  --turbo)
    CYCLE_MS=200; INTERIM=15; MAX_SUBS=40; BURST=40; CONN_PER_CYC=8; DISC_CHANCE=3
    echo "🚀 Turbo mode"
    ;;
  --gentle)
    CYCLE_MS=2000; INTERIM=60; MAX_SUBS=10; BURST=10; CONN_PER_CYC=2; DISC_CHANCE=3
    echo "🐢 Gentle mode"
    ;;
  --help|-h)
    echo "Usage: $0 [--turbo|--gentle|--help]"
    echo ""
    echo "Presets:"
    echo "  (default)  500ms cycle, 30s interim, 40 subs, burst 30"
    echo "  --turbo    200ms cycle, 15s interim, 40 subs, burst 40"
    echo "  --gentle   2s cycle, 60s interim, 10 subs, burst 10"
    echo ""
    echo "Override with env vars:"
    echo "  CYCLE_MS=200 INTERIM=15 BURST=40 ./run.sh"
    exit 0
    ;;
  "")
    echo "⚡ Default mode"
    ;;
esac

# ── Build ─────────────────────────────────────────────────────────────────
echo "Building Go binary (linux/arm64)..."
cd "$SCRIPT_DIR"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o "$BINARY" .
echo "Build OK ($(du -h "$BINARY" | cut -f1))"

# ── Check Docker network ─────────────────────────────────────────────────
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "❌ Docker network '$NETWORK' not found. Is EdgeRuntime running?"
  echo "   cd $EDGE_DIR && docker compose up -d"
  exit 1
fi

# ── Run ───────────────────────────────────────────────────────────────────
echo ""
echo "Starting simulator on Docker network: $NETWORK"
echo "  Cycle: ${CYCLE_MS}ms | Interim: ${INTERIM}s | Max: $MAX_SUBS | Burst: $BURST | Conn/cyc: $CONN_PER_CYC"
echo ""

exec docker run --rm -i \
  --network "$NETWORK" \
  --name nokia-bng-simulator \
  -v "$BINARY:/sim:ro" \
  -e RADIUS_HOST=freeradius \
  -e RADIUS_SECRET="${RADIUS_SECRET:-testing123}" \
  -e PG_CONN="postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-changeme_in_production}@postgres:5432/${POSTGRES_DB:-edge_db}?sslmode=disable" \
  -e CYCLE_MS="$CYCLE_MS" \
  -e INTERIM_INTERVAL="$INTERIM" \
  -e MAX_SUBSCRIBERS="$MAX_SUBS" \
  -e BURST_SIZE="$BURST" \
  -e CONNECTS_PER_CYCLE="$CONN_PER_CYC" \
  -e DISCONNECT_CHANCE="$DISC_CHANCE" \
  -e HEADLESS="$HEADLESS" \
  --entrypoint /sim \
  alpine:3.19
