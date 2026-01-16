#!/bin/bash
set -e

# Create keycloak database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE keycloak'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
EOSQL

# Create workspace database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE openradius_workspace_1'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'openradius_workspace_1')\gexec
EOSQL

# Apply FreeRADIUS schema to workspace database
if [ -f /docker-entrypoint-initdb.d/001_add_freeradius_tables.sql ]; then
    echo "Applying FreeRADIUS schema to openradius_workspace_1..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "openradius_workspace_1" -f /docker-entrypoint-initdb.d/001_add_freeradius_tables.sql
    echo "FreeRADIUS schema applied successfully"
fi

echo "Database initialization complete"
