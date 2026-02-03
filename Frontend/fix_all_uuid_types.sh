#!/bin/bash

# Comprehensive UUID Type Conversion Fix for Enterprise Application
# This script fixes TypeScript type mismatches after backend GUID conversion

cd /Users/amohammed/Desktop/CodeMe/openRadius/Frontend/src

echo "═══════════════════════════════════════════════════════════"
echo "  Enterprise UUID Type Conversion - Professional Fix"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Fix React State Variables
echo "✓ Step 1/6: Fixing React state variables..."

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" ! -path "*/dist/*" | while read file; do
    # Fix entity ID state variables (but not userId or workspaceId)
    perl -i -pe 's/useState<number \| null>\(null\)(\s*)\/\/\s*(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId|transactionId|activationId|webhookId|dashboardId|oltId|ipPoolId|reservationId|customAttributeId)/useState<string | null>(null)$1\/\/ $2/g' "$file"
    
    perl -i -pe 's/useState<number>\(0\)(\s*)\/\/\s*(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId)/useState<string>("")$1\/\/ $2/g' "$file"
    
    # Fix selected ID variables
    perl -i -pe 's/const \[selected(\w+)Id, setSelected\1Id\] = useState<number \| null>\(null\)/const [selected$1Id, setSelected$1Id] = useState<string | null>(null)/g' "$file"
    
    perl -i -pe 's/const \[editing(\w+)Id, setEditing\1Id\] = useState<number \| null>\(null\)/const [editing$1Id, setEditing$1Id] = useState<string | null>(null)/g' "$file"
    
    # Fix ID arrays (but not userIds)
    perl -i -pe 's/useState<number\[\]>\(\[\]\)(\s*)\/\/(?!.*user)/useState<string[]>([])$1\/\//g' "$file"
    
    perl -i -pe 's/: number\[\](\s*=\s*\[\])(\s*)\/\/\s*(?!.*user)/: string[]$1$2\/\/ /g' "$file"
done

# Step 2: Fix Component Props Interfaces
echo "✓ Step 2/6: Fixing component props and interfaces..."

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" ! -path "*/dist/*" | while read file; do
    # Fix ID props in interfaces (but preserve userId, workspaceId)
    perl -i -pe 's/^(\s+)(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId|transactionId|activationId|webhookId|dashboardId|oltId|ipPoolId|reservationId|customAttributeId)(\??):\s*number/$1$2$3: string/g' "$file"
    
    # Fix selected/editing ID props
    perl -i -pe 's/^(\s+)selected(\w+)Id(\??):\s*number/$1selected$2Id$3: string/g' "$file"
    perl -i -pe 's/^(\s+)editing(\w+)Id(\??):\s*number/$1editing$2Id$3: string/g' "$file"
    
    # Fix onSelect/onEdit callback signatures
    perl -i -pe 's/onSelect(\w+):\s*\(id:\s*number\)\s*=>/onSelect$1: (id: string) =>/g' "$file"
    perl -i -pe 's/onEdit(\w+):\s*\(id:\s*number\)\s*=>/onEdit$1: (id: string) =>/g' "$file"
    perl -i -pe 's/onDelete(\w+):\s*\(id:\s*number\)\s*=>/onDelete$1: (id: string) =>/g' "$file"
done

# Step 3: Fix Number Comparisons to GUID.Empty Pattern
echo "✓ Step 3/6: Fixing ID comparisons..."

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" ! -path "*/dist/*" | while read file; do
    # Fix === 0 comparisons for entity IDs
    perl -i -pe 's/(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId|transactionId|activationId|webhookId)\s*===\s*0/$1 === "" || !$1/g' "$file"
    
    perl -i -pe 's/(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId|transactionId|activationId|webhookId)\s*!==\s*0/$1 !== "" && $1/g' "$file"
    
    # Fix > 0 comparisons
    perl -i -pe 's/(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId)\s*>\s*0/$1 !== "" && $1/g' "$file"
done

# Step 4: Fix Function Parameter Types
echo "✓ Step 4/6: Fixing function parameters..."

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/api/*" | while read file; do
    # Fix function parameters for entity IDs
    perl -i -pe 's/\((profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId|transactionId|activationId|webhookId|dashboardId|oltId):\s*number\)/($1: string)/g' "$file"
    
    # Fix arrow function parameters
    perl -i -pe 's/\(\s*id:\s*number\s*\)\s*=>\s*(\w+Api\.(delete|update|get))/(id: string) => $1/g' "$file"
done

# Step 5: Fix Type Assertions and Casts
echo "✓ Step 5/6: Fixing type assertions..."

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" ! -path "*/dist/*" | while read file; do
    # Fix as number casts for entity IDs
    perl -i -pe 's/(profileId|groupId|addonId|automationId|tagId|zoneId|nasId|poolId)\s+as\s+number/$1 as string/g' "$file"
    
    # Fix Number() conversions
    perl -i -pe 's/Number\((profile|group|addon|automation|tag|zone|nas|pool|transaction|activation|webhook)\.id\)/$1.id/g' "$file"
    
    # Fix parseInt on entity IDs
    perl -i -pe 's/parseInt\((profile|group|addon|automation|tag|zone|nas|pool|transaction|activation|webhook)\.id\)/$1.id/g' "$file"
done

# Step 6: Fix Array Methods with Type Issues
echo "✓ Step 6/6: Fixing array operations..."

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "*/node_modules/*" ! -path "*/dist/*" | while read file; do
    # Fix map/filter returning wrong ID types
    perl -i -pe 's/\.map\(\s*(\w+)\s*=>\s*\1\.id\s*as\s*number\s*\)/.map($1 => $1.id as string)/g' "$file"
    
    # Fix includes() with number IDs
    perl -i -pe 's/\.includes\((\w+)\.id\s+as\s+number\)/.includes($1.id)/g' "$file"
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Automated fixes complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next: Running build to identify remaining manual fixes..."
