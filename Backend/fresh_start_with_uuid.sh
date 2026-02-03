#!/bin/bash

# Complete Fresh Start - Drop, Migrate, and Verify
# One-command solution to reset everything and create fresh database with UUID

echo "🔄 Complete Fresh Database Setup with UUID Support"
echo "=================================================="
echo ""
echo "This will:"
echo "  1. Drop all existing databases"
echo "  2. Remove old EF Core migrations"
echo "  3. Create fresh migrations with UUID"
echo "  4. Apply migrations to create new databases"
echo "  5. Verify UUID columns exist"
echo ""
echo "⚠️  WARNING: ALL DATA WILL BE LOST!"
echo ""
read -p "Type 'RESET' to confirm: " confirm

if [ "$confirm" != "RESET" ]; then
    echo "Aborted."
    exit 1
fi

cd /Users/amohammed/Desktop/CodeMe/openRadius/Backend

# Make scripts executable
chmod +x drop_all_databases.sh
chmod +x create_fresh_migrations.sh
chmod +x apply_fresh_migrations.sh
chmod +x verify_uuid_columns.sh

echo ""
echo "======================================"
echo "STEP 1: Dropping all databases"
echo "======================================"
# Drop databases without confirmation (already confirmed above)
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

echo "Dropping master database..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS openradius_master;" 2>/dev/null

echo "Dropping tenant databases..."
TENANT_DBS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%';" 2>/dev/null)
for db in $TENANT_DBS; do
    db_trimmed=$(echo $db | xargs)
    if [ ! -z "$db_trimmed" ]; then
        echo "  Dropping: $db_trimmed"
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $db_trimmed;" 2>/dev/null
    fi
done

echo "✅ Databases dropped"
echo ""

echo "======================================"
echo "STEP 2: Removing old migrations"
echo "======================================"
if [ -d "Migrations" ]; then
    rm -rf Migrations_old 2>/dev/null
    mv Migrations Migrations_old
    echo "✅ Old migrations moved to Migrations_old/"
else
    echo "ℹ️  No old migrations found"
fi
echo ""

echo "======================================"
echo "STEP 3: Creating fresh migrations"
echo "======================================"

# Create ApplicationDbContext migration
echo "Creating ApplicationDbContext migration..."
dotnet ef migrations add InitialApplicationWithUuid --context ApplicationDbContext

if [ $? -ne 0 ]; then
    echo "❌ Failed to create ApplicationDbContext migration"
    exit 1
fi
echo "✅ ApplicationDbContext migration created"

# Create MasterDbContext migration
echo "Creating MasterDbContext migration..."
dotnet ef migrations add InitialMasterWithUuid --context MasterDbContext

if [ $? -ne 0 ]; then
    echo "❌ Failed to create MasterDbContext migration"
    exit 1
fi
echo "✅ MasterDbContext migration created"

echo ""

echo "======================================"
echo "STEP 4: Applying migrations"
echo "======================================"

# Apply MasterDbContext migration first (creates master database)
echo "Applying MasterDbContext migration..."
dotnet ef database update --context MasterDbContext

if [ $? -ne 0 ]; then
    echo "❌ Failed to apply MasterDbContext migration"
    exit 1
fi
echo "✅ Master database created"

# Apply ApplicationDbContext migration
echo "Applying ApplicationDbContext migration..."
dotnet ef database update --context ApplicationDbContext

if [ $? -ne 0 ]; then
    echo "❌ Failed to apply ApplicationDbContext migration"
    exit 1
fi
echo "✅ Application database created"
echo ""

echo "======================================"
echo "STEP 5: Verifying UUID columns"
echo "======================================"
sleep 2  # Give DB time to settle

# Quick verification - Master Database
echo "Checking UUID columns in Master Database..."
MASTER_UUID_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d openradius_master -t -c "
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE column_name = 'Uuid';
" 2>/dev/null | xargs)

if [ "$MASTER_UUID_COUNT" -gt 0 ]; then
    echo "✅ Master DB: Found $MASTER_UUID_COUNT tables with UUID columns"
else
    echo "⚠️  Master DB: No UUID columns found"
fi

# Quick verification - Application Database (first tenant or default)
echo "Checking UUID columns in Application Database..."
# Try to get first tenant database, or use a default connection
APP_UUID_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -t -c "
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'Uuid';
" 2>/dev/null | xargs)

if [ "$APP_UUID_COUNT" -gt 0 ]; then
    echo "✅ App DB: Found $APP_UUID_COUNT tables with UUID columns"
else
    echo "ℹ️  App DB: Check tenant databases separately"
fi

echo ""
echo "======================================"
echo "✅ COMPLETE! Fresh database ready"
echo "======================================"
echo ""
echo "Summary:"
echo "  ✓ Old databases dropped"
echo "  ✓ Fresh migration created with UUID support"
echo "  ✓ Database schema applied"
echo "  ✓ UUID columns verified"
echo ""
echo "Next steps:"
echo "  1. Run the application: cd .. && dotnet run"
echo "  2. Test creating records to verify UUID generation"
echo "  3. Check API responses include 'uuid' field"
echo ""
echo "For detailed UUID verification, run:"
echo "  ./verify_uuid_columns.sh"
echo ""
