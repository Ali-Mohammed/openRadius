# OpenRadius Startup Script (PowerShell)
# This script ensures all required databases exist and starts all services
# Use this after a fresh install or after resetting databases

param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbUser = "admin",
    [string]$DbPassword = "admin123"
)

$ErrorActionPreference = "Continue"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  OpenRadius Startup Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectDir

# Step 1: Start PostgreSQL first
Write-Host "[1/6] Starting PostgreSQL..." -ForegroundColor Green
docker compose up -d postgres
Write-Host "Waiting for PostgreSQL to be healthy..."
Start-Sleep -Seconds 5

# Wait for PostgreSQL to be ready
for ($i = 1; $i -le 30; $i++) {
    $ready = docker compose exec -T postgres pg_isready -U admin -d openradius 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    Write-Host "Waiting for PostgreSQL... ($i/30)"
    Start-Sleep -Seconds 2
}

# Step 2: Create required databases
Write-Host ""
Write-Host "[2/6] Creating required databases..." -ForegroundColor Green

$env:PGPASSWORD = $DbPassword

# Create keycloak database
Write-Host "  Creating keycloak database..."
docker compose exec -T postgres psql -U admin -d postgres -c "CREATE DATABASE keycloak;" 2>$null
Write-Host "  [OK] keycloak database ready" -ForegroundColor Green

# Create openradius database (should already exist, but just in case)
Write-Host "  Creating openradius database..."
docker compose exec -T postgres psql -U admin -d postgres -c "CREATE DATABASE openradius;" 2>$null
Write-Host "  [OK] openradius database ready" -ForegroundColor Green

# List all databases
Write-Host ""
Write-Host "  Available databases:"
docker compose exec -T postgres psql -U admin -d postgres -c "\l" 2>$null | Select-String -Pattern "openradius|keycloak"

# Step 3: Start Keycloak
Write-Host ""
Write-Host "[3/6] Starting Keycloak..." -ForegroundColor Green
docker compose up -d keycloak

Write-Host "Waiting for Keycloak to be healthy..."
for ($i = 1; $i -le 60; $i++) {
    try {
        $health = docker compose exec -T keycloak curl -s http://localhost:8080/health/ready 2>$null
        if ($health -match "UP") {
            Write-Host "Keycloak is ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Write-Host "Waiting for Keycloak... ($i/60)"
    Start-Sleep -Seconds 3
}

# Step 4: Start Redpanda (Kafka)
Write-Host ""
Write-Host "[4/6] Starting Redpanda (Kafka)..." -ForegroundColor Green
docker compose up -d redpanda redpanda-console
Start-Sleep -Seconds 5

# Step 5: Start Debezium Connect
Write-Host ""
Write-Host "[5/6] Starting Debezium Connect..." -ForegroundColor Green
docker compose up -d connect_cloud
Start-Sleep -Seconds 5

# Step 6: Show status
Write-Host ""
Write-Host "[6/6] Checking service status..." -ForegroundColor Green
Write-Host ""
docker compose ps

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "  OpenRadius Startup Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services:"
Write-Host "  PostgreSQL:       http://localhost:5432" -ForegroundColor Cyan
Write-Host "  Keycloak:         http://localhost:8080 (admin/admin123)" -ForegroundColor Cyan
Write-Host "  Redpanda Console: http://localhost:8090" -ForegroundColor Cyan
Write-Host "  Debezium:         http://localhost:8083" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start the backend: cd Backend; dotnet run"
Write-Host "  2. Start the frontend: cd Frontend; pnpm dev"
Write-Host "  3. Access the app: http://localhost:5173"
Write-Host ""

$env:PGPASSWORD = ""
