#!/bin/bash
# Nokia 7750 SR BNG — Realistic RADIUS Auth Load Test
# Tests FreeRADIUS + PostgreSQL with real-world BNG traffic patterns
#
# Usage:
#   ./run.sh                  # default: 100K users, quick phases
#   ./run.sh --quick          # quick: shorter phases, 100K users
#   ./run.sh --full           # full: longer phases, realistic durations
#   ./run.sh --scale 200000   # custom: inject 200K users
#
# Phases:
#   1. STEADY STATE   — Normal PPPoE churn (lease expiry, reboots)
#   2. RAMP UP        — Morning peak (subscribers come online)
#   3. POWER OUTAGE   — Mass reconnect storm (CPEs boot staggered)
#   4. SUSTAINED PEAK — Max throughput ceiling test
#
# Environment overrides:
#   STEADY_RPS=100 PEAK_RPS=2000 ./run.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EDGE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BINARY="$SCRIPT_DIR/radius-loadtest-linux"
NETWORK="edge_edge-network"

EXTRA_ARGS=""

# ── Parse args ────────────────────────────────────────────────────────────
case "${1:-}" in
  --quick)
    EXTRA_ARGS="-quick"
    echo "⚡ Quick realistic test (100K users, shorter phases)"
    ;;
  --full)
    EXTRA_ARGS="-full"
    echo "🏗️  Full realistic test (100K users, production-length phases)"
    ;;
  --scale)
    EXTRA_ARGS="-scale=${2:-100000}"
    echo "📈 Scale test: ${2:-100000} synthetic users"
    ;;
  --help|-h)
    echo "Nokia 7750 SR BNG — Realistic RADIUS Auth Load Test"
    echo ""
    echo "Usage: $0 [--quick|--full|--scale N|--help]"
    echo ""
    echo "Presets:"
    echo "  (default)    100K users, quick phases (~2 min)"
    echo "  --quick      100K users, short phases (~1 min)"
    echo "  --full       100K users, production-length phases (~5 min)"
    echo "  --scale N    Inject N synthetic users with default phases"
    echo ""
    echo "Phases simulate real BNG traffic:"
    echo "  1. Steady State   — Normal PPPoE churn"
    echo "  2. Ramp Up        — Morning peak (06:00-08:00)"
    echo "  3. Power Outage   — Mass CPE reconnect after outage"
    echo "  4. Sustained Peak — Max throughput test"
    echo ""
    echo "Override with env vars:"
    echo "  STEADY_RPS=100 PEAK_RPS=2000 ./run.sh"
    echo "  SCALE=200000 ./run.sh --quick"
    exit 0
    ;;
  "")
    EXTRA_ARGS="-quick"
    echo "⚡ Default: Quick realistic test (100K users)"
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
echo "Running realistic BNG load test on Docker network: $NETWORK"
echo ""

exec docker run --rm -i \
  --network "$NETWORK" \
  --name radius-loadtest \
  -v "$BINARY:/loadtest:ro" \
  -e RADIUS_HOST=freeradius \
  -e RADIUS_SECRET="${RADIUS_SECRET:-testing123}" \
  -e PG_DSN="host=postgres port=5432 user=${POSTGRES_USER:-postgres} password=${POSTGRES_PASSWORD:-changeme_in_production} dbname=${POSTGRES_DB:-edge_db} sslmode=disable" \
  -e SCALE="${SCALE:-}" \
  --entrypoint /loadtest \
  alpine:3.19 $EXTRA_ARGS
