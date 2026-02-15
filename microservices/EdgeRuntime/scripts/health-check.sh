#!/bin/bash
# ============================================================================
# EdgeRuntime - Health Check
# Checks all services are running and healthy
# ============================================================================

set -euo pipefail

PROJECT="${COMPOSE_PROJECT_NAME:-edge}"
CONNECT_PORT="${CONNECT_PORT:-8084}"
CLICKHOUSE_HTTP_PORT="${CLICKHOUSE_HTTP_PORT:-8123}"

echo "============================================"
echo "  EdgeRuntime - Service Health Check"
echo "============================================"

check_service() {
    local name="$1"
    local container="${PROJECT}_${2}"
    local status
    
    status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "not_found")
    
    case "$status" in
        healthy)    echo "  ✅ $name ($container): HEALTHY" ;;
        unhealthy)  echo "  ❌ $name ($container): UNHEALTHY" ;;
        starting)   echo "  ⏳ $name ($container): STARTING" ;;
        not_found)  echo "  ⚪ $name ($container): NOT RUNNING" ;;
        *)          echo "  ⚠️  $name ($container): $status" ;;
    esac
}

echo ""
echo "Docker Containers:"
check_service "PostgreSQL" "postgres"
check_service "Redis" "redis"
check_service "Kafka Connect" "connect"
check_service "ClickHouse" "clickhouse"
check_service "Acct Forwarder" "acct_forwarder"
check_service "FreeRADIUS" "freeradius"

echo ""
echo "Service-specific checks:"

# Kafka Connect - connectors
echo ""
echo "  Kafka Connect Connectors:"
CONNECTORS=$(curl -sf "http://localhost:${CONNECT_PORT}/connectors" 2>/dev/null || echo "UNREACHABLE")
if [ "$CONNECTORS" = "UNREACHABLE" ]; then
    echo "    ⚠ Cannot reach Kafka Connect REST API"
else
    echo "    Registered: $CONNECTORS"
    for conn in $(echo "$CONNECTORS" | python3 -c "import json,sys; [print(c) for c in json.load(sys.stdin)]" 2>/dev/null); do
        STATUS=$(curl -sf "http://localhost:${CONNECT_PORT}/connectors/${conn}/status" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
state=d['connector']['state']
tasks=[f\"task-{t['id']}:{t['state']}\" for t in d.get('tasks',[])]
print(f\"{state} | Tasks: {', '.join(tasks)}\")
" 2>/dev/null || echo "UNKNOWN")
        echo "    - $conn: $STATUS"
    done
fi

# PostgreSQL - table counts
echo ""
echo "  PostgreSQL Tables:"
docker exec "${PROJECT}_postgres" psql -U postgres -d edge_db -t -c "
    SELECT '    ' || tablename || ': ' || 
           (SELECT count(*) FROM \"public\".\"' || tablename || '\"')
    FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
" 2>/dev/null || echo "    ⚠ Cannot query PostgreSQL"

# ClickHouse - row counts
echo ""
echo "  ClickHouse Tables:"
docker exec "${PROJECT}_clickhouse" clickhouse-client \
    --database radius_analytics \
    --query "SELECT concat('    ', name, ': ', toString(total_rows)) FROM system.tables WHERE database = 'radius_analytics' AND engine LIKE '%MergeTree%' ORDER BY name FORMAT TabSeparatedRaw;" 2>/dev/null || echo "    ⚠ Cannot query ClickHouse"

# Redis
echo ""
echo "  Redis:"
REDIS_INFO=$(docker exec "${PROJECT}_redis" redis-cli info keyspace 2>/dev/null | grep "^db" || echo "    (empty)")
echo "    $REDIS_INFO"

echo ""
echo "============================================"
echo "  Health check complete"
echo "============================================"
