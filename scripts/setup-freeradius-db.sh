#!/bin/bash
# Script to apply FreeRADIUS schema and triggers to openradius_workspace_1 database
# Run this if you need to manually add FreeRADIUS tables to an existing database

set -e

echo "🔧 Applying FreeRADIUS schema to openradius_workspace_1 database..."

docker exec -i openradius-postgres psql -U admin -d openradius_workspace_1 < Backend/Migrations/SQL/001_add_freeradius_tables.sql

echo "✅ FreeRADIUS schema and sync triggers applied successfully!"
echo ""
echo "📊 Verifying tables..."
docker exec -it openradius-postgres psql -U admin -d openradius_workspace_1 -c "\dt radcheck radreply radacct radusergroup radgroupcheck radgroupreply radpostauth nas"

echo ""
echo "🔍 Checking sync triggers..."
docker exec -it openradius-postgres psql -U admin -d openradius_workspace_1 -c "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'trigger_sync%';"

echo ""
echo "🎉 Setup complete! FreeRADIUS is ready to use the openradius_workspace_1 database."
