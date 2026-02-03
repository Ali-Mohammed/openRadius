#!/bin/bash

# Enterprise solution: Add Guid Uuid property to all models while keeping int Id

echo "Adding Guid Uuid property to all models..."

cd /Users/amohammed/Desktop/CodeMe/openRadius/Backend

# Find all model files except RadiusAccounting (FreeRADIUS core)
find Models -name "*.cs" -type f ! -name "RadiusAccounting.cs" | while read file; do
    echo "Processing: $file"
    
    # Check if file already has Uuid property
    if grep -q "public Guid Uuid" "$file"; then
        echo "  ↳ Already has Uuid property, skipping"
        continue
    fi
    
    # Add Uuid property right after Id property
    # Pattern: Find "public int Id { get; set; }" and add Uuid after it
    perl -i -pe 's/(public int Id \{ get; set; \})/\1\n    public Guid Uuid { get; set; } = Guid.NewGuid();/g' "$file"
    
done

echo ""
echo "✓ Uuid properties added to all models"
echo ""
echo "Next steps:"
echo "1. Add database migration to add Uuid columns"
echo "2. Generate UUIDs for existing records"
echo "3. Update DTOs to include Uuid"
echo "4. Update frontend to optionally use Uuid"
