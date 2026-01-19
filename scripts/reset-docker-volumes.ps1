# Reset Docker Volumes Script (PowerShell)
# This script removes all Docker volumes and containers related to OpenRadius
# WARNING: This will DELETE ALL DATA including PostgreSQL, Keycloak, and FreeRadius data!

$ErrorActionPreference = "Continue"

Write-Host "======================================" -ForegroundColor Yellow
Write-Host "  Docker Volumes Reset Script" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "WARNING: This will DELETE ALL DATA including:" -ForegroundColor Red
Write-Host "  - PostgreSQL data (all databases)" -ForegroundColor Red
Write-Host "  - Keycloak data and configuration" -ForegroundColor Red
Write-Host "  - FreeRadius logs and configuration" -ForegroundColor Red
Write-Host "  - All Docker containers will be stopped and removed" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted."
    exit 0
}

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host ""
Write-Host "[1/5] Stopping all OpenRadius containers..." -ForegroundColor Green

# Stop containers from main docker-compose
if (Test-Path "$ProjectDir\docker-compose.yml") {
    Push-Location $ProjectDir
    docker-compose down --remove-orphans 2>$null
    Pop-Location
}

# Stop containers from FreeRadius docker-compose
if (Test-Path "$ProjectDir\FreeRadius\docker-compose.yml") {
    Push-Location "$ProjectDir\FreeRadius"
    docker-compose down --remove-orphans 2>$null
    Pop-Location
}

Write-Host ""
Write-Host "[2/5] Removing Docker containers..." -ForegroundColor Green

# Remove any remaining containers with openradius in the name
$containers = docker ps -a --filter "name=openradius" -q 2>$null
if ($containers) { docker rm -f $containers 2>$null }

$containers = docker ps -a --filter "name=postgres" -q 2>$null
if ($containers) { docker rm -f $containers 2>$null }

$containers = docker ps -a --filter "name=keycloak" -q 2>$null
if ($containers) { docker rm -f $containers 2>$null }

$containers = docker ps -a --filter "name=freeradius" -q 2>$null
if ($containers) { docker rm -f $containers 2>$null }

Write-Host ""
Write-Host "[3/5] Listing Docker volumes to be removed..." -ForegroundColor Green

Write-Host "Volumes to be removed:"
$volumes = @()
$volumes += docker volume ls --filter "name=openradius" -q 2>$null
$volumes += docker volume ls --filter "name=postgres" -q 2>$null
$volumes += docker volume ls --filter "name=keycloak" -q 2>$null
$volumes += docker volume ls --filter "name=freeradius" -q 2>$null

foreach ($vol in $volumes) {
    if ($vol) { Write-Host "  - $vol" }
}

Write-Host ""
Write-Host "[4/5] Removing Docker volumes..." -ForegroundColor Green

# Remove volumes
$volumes = docker volume ls --filter "name=openradius" -q 2>$null
if ($volumes) { docker volume rm $volumes 2>$null }

$volumes = docker volume ls --filter "name=postgres" -q 2>$null
if ($volumes) { docker volume rm $volumes 2>$null }

$volumes = docker volume ls --filter "name=keycloak" -q 2>$null
if ($volumes) { docker volume rm $volumes 2>$null }

$volumes = docker volume ls --filter "name=freeradius" -q 2>$null
if ($volumes) { docker volume rm $volumes 2>$null }

# Also try to remove common volume naming patterns from docker-compose
docker volume rm openradius_postgres_data 2>$null
docker volume rm openradius_keycloak_data 2>$null
docker volume rm openradius_freeradius_data 2>$null
docker volume rm freeradius_postgres_data 2>$null

Write-Host ""
Write-Host "[5/5] Pruning unused Docker resources..." -ForegroundColor Green

$pruneConfirm = Read-Host "Do you also want to prune ALL unused Docker volumes? (yes/no)"
if ($pruneConfirm -eq "yes") {
    docker volume prune -f
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  Docker volumes reset complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start Docker containers: docker-compose up -d"
Write-Host "  2. Wait for PostgreSQL and Keycloak to initialize"
Write-Host "  3. Configure Keycloak realm and clients"
Write-Host "  4. Start the backend: cd Backend; dotnet run"
Write-Host "  5. Create a new workspace in the UI"
Write-Host ""
