#!/bin/bash

# Fresh Migration Setup with UUID Support
# This script creates a completely fresh database migration with UUID support built-in

echo "🚀 Creating fresh database migration with UUID support..."
echo ""

cd /Users/amohammed/Desktop/CodeMe/openRadius/Backend

# Step 1: Remove old migrations
echo "📁 Step 1: Cleaning up old migrations..."
if [ -d "Migrations" ]; then
    # Backup old migrations just in case
    if [ -d "Migrations_backup" ]; then
        rm -rf Migrations_backup
    fi
    mv Migrations Migrations_backup
    echo "  ✓ Old migrations backed up to Migrations_backup/"
fi

# Step 2: Create fresh migration with UUID support
echo ""
echo "📝 Step 2: Creating fresh migration with UUID..."
dotnet ef migrations add InitialWithUuid --context ApplicationDbContext --output-dir Migrations/Application

if [ $? -eq 0 ]; then
    echo "  ✓ Application migration created successfully"
else
    echo "  ✗ Failed to create Application migration"
    exit 1
fi

# Step 3: Create master database migration (if you have MasterDbContext)
echo ""
echo "📝 Step 3: Checking for MasterDbContext..."
if grep -q "class MasterDbContext" Data/*.cs 2>/dev/null; then
    echo "  Found MasterDbContext, creating migration..."
    dotnet ef migrations add InitialMaster --context MasterDbContext --output-dir Migrations/Master
    
    if [ $? -eq 0 ]; then
        echo "  ✓ Master migration created successfully"
    else
        echo "  ✗ Failed to create Master migration"
    fi
else
    echo "  ℹ No MasterDbContext found, skipping"
fi

echo ""
echo "✅ Fresh migrations created with UUID support!"
echo ""
echo "Next steps:"
echo "1. Review migrations in Backend/Migrations/"
echo "2. Apply migrations: ./apply_fresh_migrations.sh"
echo "3. Verify UUID columns exist in database"
echo ""
