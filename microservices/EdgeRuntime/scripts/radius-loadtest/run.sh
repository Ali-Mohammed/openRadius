#!/bin/bash
# RADIUS Authentication Load Test — Run Script
# Tests if FreeRADIUS + PostgreSQL can handle concurrent auth for all users
#
# Usage:
#   ./run.sh                  # default: 5 rounds, 50 concurrency
#   ./run.sh --quick          # quick: 3 rounds, 20 concurrency
#   ./run.sh --stress         # stress: 10 rounds, 200 concurrency
#   ./run.sh --extreme        # extreme: inject 100K users, 500 concurrency
#   ./run.sh --scale 50000    # custom scale: inject 50K users
#
# Environment overrides:
#   CONCURRENCY=100 ROUNDS=10 ./run.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EDGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARY="$SCRIPT_DIR/radius-loadtest-linux"
NETWORK="edge_edge-network"

# ── Defaults ──────────────────────────────────────────────────────────────
CONCURRENCY="${CONCURRENCY:-50}"
ROUNDS="${ROUNDS:-5}"
SCALE="${SCALE:-0}"
VERBOSE="${VERBOSE:-false}"
EXTRA_ARGS=""

# ── Parse args ────────────────────────────────────────────────────────────
case "${1:-}" in
  --quick)
    EXTRA_ARGS="-quick"
    echo "⚡ Quick test mode"
    ;;
  --stress)
    EXTRA_ARGS="-stress"
    echo "🔥 Stress test mode"
    ;;
  --extreme)
    EXTRA_ARGS="-extreme"
    echo "💀 Extreme test mode (100K users)"
    ;;
  --scale)
    SCALE="${2:-10000}"
    echo "📈 Scale test: $SCALE synthetic users"
    ;;
  --verbose|-v)
    VERBOSE="true"
    ;;
  --help|-h)
    echo "Usage: $0 [--quick|--stress|--extreme|--scale N|--help]"
    echo ""
    echo "Presets:"
    echo "  (default)    5 rounds, 50 concurrency, real users only"
    echo "  --quick      3 rounds, 20 concurrency"
    echo "  --stress     10 rounds, 200 concurrency"
    echo "  --extreme    100K injected users, 10 rounds, 500 concurrency"
    echo "  --scale N    Inject N synthetic users for scale testing"
    echo ""
    echo "Override with env vars:"
    echo "  CONCURRENCY=100 ROUNDS=10 ./run.sh"
    echo "  RADIUS_SECRET=mysecret ./run.sh"
    exit 0
    ;;
  "")
    echo "⚡ Default load test"
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

# ── Build CLI args ────────────────────────────────────────────────────────
CLI_ARGS="$EXTRA_ARGS"
if [[ "$SCALE" -gt 0 ]] && [[ -z "$EXTRA_ARGS" ]]; then
  CLI_ARGS="$CLI_ARGS -scale=$SCALE"
fi
if [[ "$VERBOSE" == "true" ]]; then
  CLI_ARGS="$CLI_ARGS -verbose"
fi
# Only pass concurrency/rounds if not using a preset
if [[ -z "$EXTRA_ARGS" ]]; then
  CLI_ARGS="$CLI_ARGS -concurrency=$CONCURRENCY -rounds=$ROUNDS"
fi

# ── Run ───────────────────────────────────────────────────────────────────
echo ""
echo "Running load test on Docker network: $NETWORK"
echo ""

exec docker run --rm -i \
  --network "$NETWORK" \
  --name radius-loadtest \
  -v "$BINARY:/loadtest:ro" \
  -e RADIUS_HOST=freeradius \
  -e RADIUS_SECRET="${RADIUS_SECRET:-testing123}" \
  -e PG_DSN="host=postgres port=5432 user=${POSTGRES_USER:-postgres} password=${POSTGRES_PASSWORD:-changeme_in_production} dbname=${POSTGRES_DB:-edge_db} sslmode=disable" \
  --entrypoint /loadtest \
  alpine:3.19 $CLI_ARGS
