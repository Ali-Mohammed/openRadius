#!/bin/bash

# Drop All Databases - Fresh Start Script
# WARNING: This will delete ALL data! Use only in development!

echo "⚠️  WARNING: This will DROP all databases and DELETE all data!"
echo "This script should ONLY be used in development environments."
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "🗑️  Dropping databases..."

# Get database connection details from appsettings
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"

# Master database name
MASTER_DB="openradius_master"

# Connect to postgres database to drop others
export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

echo "Dropping master database: $MASTER_DB"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $MASTER_DB;" 2>/dev/null

# Drop all tenant databases (pattern: starts with tenant_)
echo "Finding and dropping tenant databases..."
TENANT_DBS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%';")

for db in $TENANT_DBS; do
    db_trimmed=$(echo $db | xargs) # trim whitespace
    if [ ! -z "$db_trimmed" ]; then
        echo "  Dropping: $db_trimmed"
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $db_trimmed;" 2>/dev/null
    fi
done

echo ""
echo "✅ All databases dropped successfully!"
echo ""
echo "Next steps:"
echo "1. Delete existing EF Core migrations: rm -rf Backend/Migrations/*.cs"
echo "2. Create fresh migration with UUID: dotnet ef migrations add InitialWithUuid"
echo "3. Apply migration: dotnet ef database update"
echo ""
