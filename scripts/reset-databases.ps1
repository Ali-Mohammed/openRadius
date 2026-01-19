# Reset OpenRadius Databases Script (PowerShell)
# This script drops all OpenRadius databases and recreates them fresh
# WARNING: This will DELETE ALL DATA!

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbUser = "admin",
    [string]$DbPassword = "admin123",
    [string]$MasterDb = "openradius",
    [string]$KeycloakDb = "keycloak"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Yellow
Write-Host "  OpenRadius Database Reset Script" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This will DELETE ALL DATA in:" -ForegroundColor Red
Write-Host "  - OpenRadius master database" -ForegroundColor Red
Write-Host "  - All workspace databases" -ForegroundColor Red
Write-Host "  - Keycloak database" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted."
    exit 0
}

$env:PGPASSWORD = $DbPassword

Write-Host ""
Write-Host "[1/4] Finding all OpenRadius databases..." -ForegroundColor Green

# Get list of all workspace databases
$workspaceDbs = psql -h $DbHost -p $DbPort -U $DbUser -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'openradius_workspace_%';" 2>$null | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }

Write-Host "Found workspace databases:"
if ($null -eq $workspaceDbs -or $workspaceDbs.Count -eq 0) {
    Write-Host "  (none)"
} else {
    foreach ($db in $workspaceDbs) {
        Write-Host "  - $db"
    }
}

Write-Host ""
Write-Host "[2/4] Dropping workspace databases..." -ForegroundColor Green

# Drop each workspace database
foreach ($db in $workspaceDbs) {
    if ($db) {
        Write-Host "  Dropping $db..."
        psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS `"$db`";" 2>$null
    }
}

Write-Host ""
Write-Host "[3/5] Dropping master database ($MasterDb)..." -ForegroundColor Green

# Terminate connections to master database
psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c @"
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$MasterDb'
AND pid <> pg_backend_pid();
"@ 2>$null

# Drop master database
psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS `"$MasterDb`";" 2>$null

Write-Host ""
Write-Host "[4/5] Dropping Keycloak database ($KeycloakDb)..." -ForegroundColor Green

# Terminate connections to keycloak database
psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c @"
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '$KeycloakDb'
AND pid <> pg_backend_pid();
"@ 2>$null

# Drop keycloak database
psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS `"$KeycloakDb`";" 2>$null

Write-Host ""
Write-Host "[5/5] Creating fresh databases..." -ForegroundColor Green

# Create fresh master database
Write-Host "  Creating $MasterDb..."
psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "CREATE DATABASE `"$MasterDb`";" 2>$null

# Create fresh keycloak database
Write-Host "  Creating $KeycloakDb..."
psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "CREATE DATABASE `"$KeycloakDb`";" 2>$null

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Database reset complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Restart Keycloak: docker-compose restart keycloak"
Write-Host "  2. Reconfigure Keycloak realm and clients"
Write-Host "  3. Start the backend: cd Backend; dotnet run"
Write-Host "  4. EF Core migrations will auto-apply on startup"
Write-Host "  5. Create a new workspace in the UI"
Write-Host ""

$env:PGPASSWORD = ""
