#!/bin/bash

# Verify UUID Columns in Database

echo "🔍 Verifying UUID columns in database..."
echo ""

DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

# Function to check UUID columns in a database
check_uuid_columns() {
    local db_name=$1
    
    echo "Checking database: $db_name"
    echo "----------------------------------------"
    
    # Check if database exists
    db_exists=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='$db_name';" 2>/dev/null | xargs)
    
    if [ "$db_exists" != "1" ]; then
        echo "  ⚠️  Database does not exist"
        echo ""
        return
    fi
    
    # List all tables with UUID column
    uuid_tables=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $db_name -t -c "
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'Uuid' 
        ORDER BY table_name;
    " 2>/dev/null)
    
    if [ -z "$uuid_tables" ]; then
        echo "  ❌ No UUID columns found"
    else
        echo "  ✅ UUID columns found in tables:"
        echo "$uuid_tables" | while read -r table; do
            table_trimmed=$(echo $table | xargs)
            if [ ! -z "$table_trimmed" ]; then
                echo "     - $table_trimmed"
            fi
        done
        
        # Count UUID columns
        uuid_count=$(echo "$uuid_tables" | grep -v '^[[:space:]]*$' | wc -l | xargs)
        echo "  📊 Total tables with UUID: $uuid_count"
        
        # Sample UUID from first table
        first_table=$(echo "$uuid_tables" | head -1 | xargs)
        if [ ! -z "$first_table" ]; then
            echo ""
            echo "  Sample UUIDs from $first_table:"
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $db_name -c "
                SELECT \"Id\", \"Uuid\" 
                FROM \"$first_table\" 
                LIMIT 3;
            " 2>/dev/null
        fi
    fi
    
    echo ""
}

# Check master database
check_uuid_columns "openradius_master"

# Check tenant databases
echo "Checking tenant databases..."
echo "========================================"
TENANT_DBS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%';" 2>/dev/null)

if [ -z "$TENANT_DBS" ]; then
    echo "No tenant databases found"
else
    for db in $TENANT_DBS; do
        db_trimmed=$(echo $db | xargs)
        if [ ! -z "$db_trimmed" ]; then
            check_uuid_columns "$db_trimmed"
        fi
    done
fi

echo ""
echo "✅ UUID verification complete!"
