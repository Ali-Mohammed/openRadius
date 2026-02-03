#!/bin/bash

# Add uuid property to frontend TypeScript interfaces

echo "Adding uuid to frontend interfaces..."

cd /Users/amohammed/Desktop/CodeMe/openRadius/Frontend

# Find all API files
find src/api -name "*.ts" -type f | while read file; do
    echo "Processing: $file"
    
    # Add uuid after id property in interfaces
    # Pattern: "id: number;" followed by newline -> add "uuid: string;" after it
    perl -i -pe 's/^(\s+id: number;)$/\1\n  uuid: string;/g' "$file"
    
done

echo ""
echo "✓ uuid properties added to frontend interfaces"
echo ""
echo "Note: Some interfaces may need manual review for optional (?) vs required"
