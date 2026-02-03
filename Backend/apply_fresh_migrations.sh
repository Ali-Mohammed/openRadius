#!/bin/bash

# Apply Fresh Migrations - Creates databases and applies all migrations

echo "🚀 Applying fresh migrations..."
echo ""

cd /Users/amohammed/Desktop/CodeMe/openRadius/Backend

# Step 1: Apply ApplicationDbContext migration
echo "📊 Step 1: Applying ApplicationDbContext migration..."
echo "This will create tenant database schema with UUID support..."
dotnet ef database update --context ApplicationDbContext

if [ $? -eq 0 ]; then
    echo "  ✓ ApplicationDbContext migration applied successfully"
else
    echo "  ✗ Failed to apply ApplicationDbContext migration"
    exit 1
fi

# Step 2: Apply MasterDbContext migration (if exists)
echo ""
echo "📊 Step 2: Checking for MasterDbContext migration..."
if [ -d "Migrations/Master" ]; then
    echo "Applying MasterDbContext migration..."
    dotnet ef database update --context MasterDbContext
    
    if [ $? -eq 0 ]; then
        echo "  ✓ MasterDbContext migration applied successfully"
    else
        echo "  ✗ Failed to apply MasterDbContext migration"
        exit 1
    fi
else
    echo "  ℹ No MasterDbContext migration found, skipping"
fi

echo ""
echo "✅ All migrations applied successfully!"
echo ""
echo "Next steps:"
echo "1. Verify databases exist: psql -l | grep openradius"
echo "2. Check for UUID columns: ./verify_uuid_columns.sh"
echo "3. Run application: dotnet run"
echo ""
