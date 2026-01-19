#!/bin/bash

# Reset OpenRadius Databases Script
# This script drops all OpenRadius databases and recreates them fresh
# WARNING: This will DELETE ALL DATA!

set -e

# Database connection settings (adjust as needed)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin123}"
MASTER_DB="openradius"
KEYCLOAK_DB="keycloak"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  OpenRadius Database Reset Script${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
echo -e "${RED}WARNING: This will DELETE ALL DATA in:${NC}"
echo -e "${RED}  - OpenRadius master database${NC}"
echo -e "${RED}  - All workspace databases${NC}"
echo -e "${RED}  - Keycloak database${NC}"
echo ""

# Confirm before proceeding
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

export PGPASSWORD="$DB_PASSWORD"

echo ""
echo -e "${GREEN}[1/4] Finding all OpenRadius databases...${NC}"

# Get list of all workspace databases
WORKSPACE_DBS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'openradius_workspace_%';" 2>/dev/null | tr -d ' ')

echo "Found workspace databases:"
if [ -z "$WORKSPACE_DBS" ]; then
    echo "  (none)"
else
    echo "$WORKSPACE_DBS" | while read db; do
        [ -n "$db" ] && echo "  - $db"
    done
fi

echo ""
echo -e "${GREEN}[2/4] Dropping workspace databases...${NC}"

# Drop each workspace database
echo "$WORKSPACE_DBS" | while read db; do
    if [ -n "$db" ]; then
        echo "  Dropping $db..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$db\";" 2>/dev/null || true
    fi
done

echo ""
echo -e "${GREEN}[3/5] Dropping master database ($MASTER_DB)...${NC}"

# Terminate connections to master database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$MASTER_DB'
AND pid <> pg_backend_pid();" 2>/dev/null || true

# Drop master database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$MASTER_DB\";" 2>/dev/null || true

echo ""
echo -e "${GREEN}[4/5] Dropping Keycloak database ($KEYCLOAK_DB)...${NC}"

# Terminate connections to keycloak database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$KEYCLOAK_DB'
AND pid <> pg_backend_pid();" 2>/dev/null || true

# Drop keycloak database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$KEYCLOAK_DB\";" 2>/dev/null || true

echo ""
echo -e "${GREEN}[5/5] Creating fresh databases...${NC}"

# Create fresh master database
echo "  Creating $MASTER_DB..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$MASTER_DB\";" 2>/dev/null

# Create fresh keycloak database
echo "  Creating $KEYCLOAK_DB..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$KEYCLOAK_DB\";" 2>/dev/null

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Database reset complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart Keycloak: docker-compose restart keycloak"
echo "  2. Reconfigure Keycloak realm and clients"
echo "  3. Start the backend: cd Backend && dotnet run"
echo "  4. EF Core migrations will auto-apply on startup"
echo "  5. Create a new workspace in the UI"
echo ""

unset PGPASSWORD
