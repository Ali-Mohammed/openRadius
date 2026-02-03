#!/bin/bash

# Add Uuid property to all DTOs in controllers

echo "Adding Uuid to DTOs..."

cd /Users/amohammed/Desktop/CodeMe/openRadius/Backend

# Process all controller files
find Controllers -name "*Controller.cs" -type f | while read file; do
    echo "Processing: $file"
    
    # Add Uuid property to response DTOs (classes with Id property)
    # This targets the DTO class definitions within controller files
    
    # Pattern 1: After "public int Id { get; set; }" add "public Guid Uuid { get; set; }"
    perl -i -pe 's/^(\s+public int Id \{ get; set; \})$/\1\n    public Guid Uuid { get; set; }/g' "$file"
    
done

echo ""
echo "✓ Uuid properties added to DTOs in controllers"
echo ""
echo "Note: Some DTOs in Services folder may need manual review"
