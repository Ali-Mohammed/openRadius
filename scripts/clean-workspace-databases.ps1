# Clean all workspace databases
# This script drops all openradius_workspace_* databases

$ErrorActionPreference = "Stop"

Write-Host "Cleaning all workspace databases..." -ForegroundColor Cyan

# Set PostgreSQL password environment variable
$env:PGPASSWORD = 'admin123'

# Get list of workspace databases
try {
    $databases = & docker exec openradius-postgres-1 psql -h localhost -U admin -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'openradius_workspace_%';" 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error getting database list. Is PostgreSQL running?" -ForegroundColor Red
        exit 1
    }
    
    # Parse and drop each database
    $databases | ForEach-Object {
        $dbName = $_.Trim()
        if ($dbName -ne '') {
            Write-Host "Dropping database: $dbName" -ForegroundColor Yellow
            $dropCmd = "DROP DATABASE IF EXISTS ""$dbName"";"
            & docker exec openradius-postgres-1 psql -h localhost -U admin -d postgres -c $dropCmd 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✓ Dropped $dbName" -ForegroundColor Green
            } else {
                Write-Host "  ✗ Failed to drop $dbName" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "`n✓ All workspace databases cleaned!" -ForegroundColor Green
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
