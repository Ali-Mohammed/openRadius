#!/bin/bash

# OpenRadius Startup Script
# This script ensures all required databases exist and starts all services
# Use this after a fresh install or after resetting databases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Database connection settings
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin123}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  OpenRadius Startup Script${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

cd "$PROJECT_DIR"

# Step 1: Start PostgreSQL first
echo -e "${GREEN}[1/6] Starting PostgreSQL...${NC}"
docker-compose up -d postgres
echo "Waiting for PostgreSQL to be healthy..."
sleep 5

# Wait for PostgreSQL to be ready
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U admin -d openradius > /dev/null 2>&1; then
        echo -e "${GREEN}PostgreSQL is ready!${NC}"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done

# Step 2: Create required databases
echo ""
echo -e "${GREEN}[2/6] Creating required databases...${NC}"

export PGPASSWORD="$DB_PASSWORD"

# Create keycloak database
echo "  Creating keycloak database..."
docker-compose exec -T postgres psql -U admin -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'keycloak'" | grep -q 1 || \
docker-compose exec -T postgres psql -U admin -d postgres -c "CREATE DATABASE keycloak;"
echo -e "  ${GREEN}✓ keycloak database ready${NC}"

# Create openradius database (should already exist, but just in case)
echo "  Creating openradius database..."
docker-compose exec -T postgres psql -U admin -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'openradius'" | grep -q 1 || \
docker-compose exec -T postgres psql -U admin -d postgres -c "CREATE DATABASE openradius;"
echo -e "  ${GREEN}✓ openradius database ready${NC}"

# List all databases
echo ""
echo "  Available databases:"
docker-compose exec -T postgres psql -U admin -d postgres -c "\l" | grep -E "openradius|keycloak" || true

# Step 3: Start Keycloak
echo ""
echo -e "${GREEN}[3/6] Starting Keycloak...${NC}"
docker-compose up -d keycloak

echo "Waiting for Keycloak to be healthy..."
for i in {1..60}; do
    if docker-compose exec -T keycloak curl -s http://localhost:8080/health/ready 2>/dev/null | grep -q "UP"; then
        echo -e "${GREEN}Keycloak is ready!${NC}"
        break
    fi
    echo "Waiting for Keycloak... ($i/60)"
    sleep 3
done

# Configure account-console client scopes
echo ""
echo -e "${YELLOW}Configuring account-console client...${NC}"
if [ -f "$SCRIPT_DIR/configure-account-console.sh" ]; then
    bash "$SCRIPT_DIR/configure-account-console.sh"
else
    echo -e "${YELLOW}Warning: configure-account-console.sh not found. Skipping...${NC}"
fi

# Step 4: Start Redpanda (Kafka)
echo ""
echo -e "${GREEN}[4/6] Starting Redpanda (Kafka)...${NC}"
docker-compose up -d redpanda redpanda-console
sleep 5

# Step 5: Start Debezium Connect
echo ""
echo -e "${GREEN}[5/6] Starting Debezium Connect...${NC}"
docker-compose up -d connect_cloud
sleep 5

# Step 6: Show status
echo ""
echo -e "${GREEN}[6/6] Checking service status...${NC}"
echo ""
docker-compose ps

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  OpenRadius Startup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Services:"
echo -e "  ${CYAN}PostgreSQL:${NC}      http://localhost:5432"
echo -e "  ${CYAN}Keycloak:${NC}        http://localhost:8080 (admin/admin123)"
echo -e "  ${CYAN}Redpanda Console:${NC} http://localhost:8090"
echo -e "  ${CYAN}Debezium:${NC}        http://localhost:8083"
echo ""
echo "Next steps:"
echo "  1. Start the backend: cd Backend && dotnet run"
echo "  2. Start the frontend: cd Frontend && pnpm dev"
echo "  3. Access the app: http://localhost:5173"
echo ""

unset PGPASSWORD
