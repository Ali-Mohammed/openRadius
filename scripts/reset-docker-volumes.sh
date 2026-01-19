#!/bin/bash

# Reset Docker Volumes Script
# This script removes all Docker volumes and containers related to OpenRadius
# WARNING: This will DELETE ALL DATA including PostgreSQL, Keycloak, and FreeRadius data!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}  Docker Volumes Reset Script${NC}"
echo -e "${YELLOW}======================================${NC}"
echo ""
echo -e "${RED}WARNING: This will DELETE ALL DATA including:${NC}"
echo -e "${RED}  - PostgreSQL data (all databases)${NC}"
echo -e "${RED}  - Keycloak data and configuration${NC}"
echo -e "${RED}  - FreeRadius logs and configuration${NC}"
echo -e "${RED}  - All Docker containers will be stopped and removed${NC}"
echo ""

# Confirm before proceeding
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${GREEN}[1/5] Stopping all OpenRadius containers...${NC}"

# Stop containers from main docker-compose
if [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
    cd "$PROJECT_DIR"
    docker-compose down --remove-orphans 2>/dev/null || true
fi

# Stop containers from FreeRadius docker-compose
if [ -f "$PROJECT_DIR/FreeRadius/docker-compose.yml" ]; then
    cd "$PROJECT_DIR/FreeRadius"
    docker-compose down --remove-orphans 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}[2/5] Removing Docker containers...${NC}"

# Remove any remaining containers with openradius in the name
docker ps -a --filter "name=openradius" -q | xargs -r docker rm -f 2>/dev/null || true
docker ps -a --filter "name=postgres" -q | xargs -r docker rm -f 2>/dev/null || true
docker ps -a --filter "name=keycloak" -q | xargs -r docker rm -f 2>/dev/null || true
docker ps -a --filter "name=freeradius" -q | xargs -r docker rm -f 2>/dev/null || true

echo ""
echo -e "${GREEN}[3/5] Listing Docker volumes to be removed...${NC}"

# List volumes that will be removed
echo "Volumes to be removed:"
docker volume ls --filter "name=openradius" -q 2>/dev/null | while read vol; do
    echo "  - $vol"
done
docker volume ls --filter "name=postgres" -q 2>/dev/null | while read vol; do
    echo "  - $vol"
done
docker volume ls --filter "name=keycloak" -q 2>/dev/null | while read vol; do
    echo "  - $vol"
done
docker volume ls --filter "name=freeradius" -q 2>/dev/null | while read vol; do
    echo "  - $vol"
done

echo ""
echo -e "${GREEN}[4/5] Removing Docker volumes...${NC}"

# Remove volumes
docker volume ls --filter "name=openradius" -q | xargs -r docker volume rm 2>/dev/null || true
docker volume ls --filter "name=postgres" -q | xargs -r docker volume rm 2>/dev/null || true
docker volume ls --filter "name=keycloak" -q | xargs -r docker volume rm 2>/dev/null || true
docker volume ls --filter "name=freeradius" -q | xargs -r docker volume rm 2>/dev/null || true

# Also try to remove common volume naming patterns from docker-compose
docker volume rm openradius_postgres_data 2>/dev/null || true
docker volume rm openradius_keycloak_data 2>/dev/null || true
docker volume rm openradius_freeradius_data 2>/dev/null || true
docker volume rm freeradius_postgres_data 2>/dev/null || true

echo ""
echo -e "${GREEN}[5/5] Pruning unused Docker resources...${NC}"

# Optional: Prune dangling volumes (be careful with this)
read -p "Do you also want to prune ALL unused Docker volumes? (yes/no): " prune_confirm
if [ "$prune_confirm" == "yes" ]; then
    docker volume prune -f
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Docker volumes reset complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Start Docker containers: docker-compose up -d"
echo "  2. Wait for PostgreSQL and Keycloak to initialize"
echo "  3. Configure Keycloak realm and clients"
echo "  4. Start the backend: cd Backend && dotnet run"
echo "  5. Create a new workspace in the UI"
echo ""
