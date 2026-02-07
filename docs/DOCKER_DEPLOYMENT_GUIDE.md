# OpenRadius - Docker Deployment Guide

Complete workflow for building, publishing, and deploying OpenRadius to production using Docker.

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Build Workflow](#build-workflow)
- [Docker Hub Publishing](#docker-hub-publishing)
- [Production Deployment](#production-deployment)
- [Maintenance & Updates](#maintenance--updates)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Docker Engine 24.0+
- Docker Compose 2.20+
- Docker Hub account
- Git (for version tagging)

### Docker Hub Setup
```bash
# Login to Docker Hub
docker login

# Enter your Docker Hub credentials when prompted
Username: your-dockerhub-username
Password: your-dockerhub-password
```

### Environment Variables
Create a `.env` file in the project root:
```env
# Docker Hub Configuration
DOCKER_HUB_USERNAME=alimohammed

# Database
POSTGRES_PASSWORD=your_secure_postgres_password

# Keycloak
KEYCLOAK_ADMIN_PASSWORD=your_secure_keycloak_password

# Redis
REDIS_PASSWORD=your_secure_redis_password

# Switch Decryption
SWITCH_DECRYPTION_KEY=YOUR_SWITCH_DECRYPTION_KEY_HEX
```

---

## Build Workflow

### Step 1: Prepare for Build

```bash
# Navigate to project root
cd /path/to/openRadius

# Ensure you're on the correct branch
git checkout main  # or your production branch

# Pull latest changes
git pull origin main

# Optional: Tag the release
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### Step 2: Build Docker Images

#### Backend Image
```bash
# Build the backend image
docker build \
  -t alimohammed/openradius-backend:latest \
  -t alimohammed/openradius-backend:v1.0.0 \
  ./Backend

# Verify the build
docker images | grep alimohammed/openradius-backend
```

**Expected Output:**
```
alimohammed/openradius-backend   latest   abc123def456   2 minutes ago   200MB
alimohammed/openradius-backend   v1.0.0   abc123def456   2 minutes ago   200MB
```

#### Frontend Image
```bash
# Build the frontend image
docker build \
  -t alimohammed/openradius-frontend:latest \
  -t alimohammed/openradius-frontend:v1.0.0 \
  ./Frontend

# Verify the build
docker images | grep alimohammed/openradius-frontend
```

**Expected Output:**
```
alimohammed/openradius-frontend   latest   def456ghi789   1 minute ago    50MB
alimohammed/openradius-frontend   v1.0.0   def456ghi789   1 minute ago    50MB
```

**Note:** Frontend build uses `build:skip-checks` script to bypass TypeScript errors for faster production builds. The build includes a fallback mechanism that skips type checking if the standard build fails.

### Step 3: Test Images Locally (Optional but Recommended)

```bash
# Test backend image
docker run --rm -p 5000:5000 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  alimohammed/openradius-backend:latest

# In another terminal, test the endpoint
curl http://localhost:5000/health

# Test frontend image
docker run --rm -p 8080:80 \
  alimohammed/openradius-frontend:latest

# Open browser: http://localhost:8080
```

---

## Docker Hub Publishing

### Step 1: Push Images to Docker Hub

#### Push Backend
```bash
# Push latest tag
docker push alimohammed/openradius-backend:latest

# Push version tag
docker push alimohammed/openradius-backend:v1.0.0
```

#### Push Frontend
```bash
# Push latest tag
docker push alimohammed/openradius-frontend:latest

# Push version tag
docker push alimohammed/openradius-frontend:v1.0.0
```

### Step 2: Verify Published Images

```bash
# List your repositories
docker search alimohammed

# Or visit Docker Hub web interface
# https://hub.docker.com/r/alimohammed/openradius-backend
# https://hub.docker.com/r/alimohammed/openradius-frontend
```

### Step 3: Make Repositories Public (Optional)

1. Go to Docker Hub: https://hub.docker.com
2. Navigate to your repository (e.g., `alimohammed/openradius-backend`)
3. Click **Settings** → **Visibility**
4. Set to **Public** if you want open access
5. Repeat for `alimohammed/openradius-frontend`

---

## Production Deployment

### Step 1: Prepare Production Server

```bash
# SSH into production server
ssh user@production-server.com

# Install Docker & Docker Compose (if not already installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Clone Repository (or Copy docker-compose.prod.yml)

**Option A: Clone Full Repository**
```bash
git clone https://github.com/your-org/openRadius.git
cd openRadius
```

**Option B: Copy Only Required Files**
```bash
mkdir openradius-prod
cd openradius-prod

# Copy docker-compose.prod.yml and .env
scp docker-compose.prod.yml user@production-server:/opt/openradius/
scp .env user@production-server:/opt/openradius/
scp init-db.sh user@production-server:/opt/openradius/
```

### Step 3: Configure Environment

```bash
# Create/edit .env file
nano .env
```

```env
# Docker Hub Configuration
DOCKER_HUB_USERNAME=alimohammed

# Database
POSTGRES_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# Keycloak
KEYCLOAK_ADMIN_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# Redis
REDIS_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# Switch Decryption
SWITCH_DECRYPTION_KEY=YOUR_ACTUAL_SWITCH_KEY_HEX
```

### Step 4: Deploy the Stack

```bash
# Pull latest images from Docker Hub
docker-compose -f docker-compose.prod.yml pull

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Watch logs (Ctrl+C to exit, containers keep running)
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 5: Verify Deployment

```bash
# Check all containers are running
docker-compose -f docker-compose.prod.yml ps

# Check health status
docker ps --filter "name=openradius" --format "table {{.Names}}\t{{.Status}}"

# Test endpoints
curl http://localhost:5000/health          # Backend health
curl http://localhost/                      # Frontend
curl http://localhost:8080/health          # Keycloak
```

**Expected Output:**
```
NAME                         STATUS
openradius-frontend          Up 2 minutes (healthy)
openradius-backend           Up 2 minutes (healthy)
openradius-postgres          Up 3 minutes (healthy)
openradius-keycloak          Up 3 minutes (healthy)
openradius-redis             Up 3 minutes (healthy)
openradius-redpanda          Up 3 minutes (healthy)
openradius-debezium          Up 2 minutes (healthy)
```

### Step 6: Initialize Database & Keycloak

```bash
# Check backend logs for database migration
docker-compose -f docker-compose.prod.yml logs backend | grep -i "migration"

# Access Keycloak admin console
# http://your-server-ip:8080
# Username: admin
# Password: (from KEYCLOAK_ADMIN_PASSWORD in .env)

# Configure Keycloak realm: openradius
# Create client: openradius-frontend
# Configure OIDC settings
```

---

## Maintenance & Updates

### Update to New Version

```bash
# On your development machine
# 1. Build new images
docker build -t alimohammed/openradius-backend:v1.1.0 -t alimohammed/openradius-backend:latest ./Backend
docker build -t alimohammed/openradius-frontend:v1.1.0 -t alimohammed/openradius-frontend:latest ./Frontend

# 2. Push to Docker Hub
docker push alimohammed/openradius-backend:v1.1.0
docker push alimohammed/openradius-backend:latest
docker push alimohammed/openradius-frontend:v1.1.0
docker push alimohammed/openradius-frontend:latest

# On production server
# 3. Pull and restart
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# 4. Verify update
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f backend frontend
```

### Rollback to Previous Version

```bash
# Update docker-compose.prod.yml to use specific version
# Change:
#   image: alimohammed/openradius-backend:latest
# To:
#   image: alimohammed/openradius-backend:v1.0.0

# Restart services
docker-compose -f docker-compose.prod.yml up -d backend frontend
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# Save logs to file
docker-compose -f docker-compose.prod.yml logs --no-color > openradius.log
```

### Backup Data

```bash
# Backup PostgreSQL database
docker exec openradius-postgres pg_dumpall -U admin > backup_$(date +%Y%m%d).sql

# Backup volumes
docker run --rm \
  -v openradius_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz /data

# Backup Redis
docker exec openradius-redis redis-cli --rdb /data/dump.rdb
```

### Restore Data

```bash
# Restore PostgreSQL
cat backup_20260206.sql | docker exec -i openradius-postgres psql -U admin

# Restore volume
docker run --rm \
  -v openradius_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_backup_20260206.tar.gz -C /
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs backend

# Check specific container
docker logs openradius-backend

# Inspect container
docker inspect openradius-backend

# Check resource usage
docker stats
```

### Database Connection Issues

```bash
# Verify PostgreSQL is healthy
docker exec openradius-postgres pg_isready -U admin

# Test connection from backend
docker exec openradius-backend ping postgres

# Check network
docker network inspect openradius_openradius-network
```

### Image Pull Failures

```bash
# Verify Docker Hub credentials
docker login

# Manually pull image
docker pull alimohammed/openradius-backend:latest

# Check for rate limiting
docker pull alimohammed/openradius-backend:latest --quiet

# Use authenticated pull
docker login
docker-compose -f docker-compose.prod.yml pull
```

### TypeScript Build Errors (Frontend)

If you encounter TypeScript errors during frontend build:

```bash
# The Dockerfile includes a fallback mechanism
# It first tries: pnpm run build (with TypeScript checks)
# If that fails, it runs: pnpm run build:skip-checks (skips type checking)

# To fix TypeScript errors permanently:
cd Frontend
# Fix the specific TypeScript errors shown in the build output
# Then rebuild:
docker build -t alimohammed/openradius-frontend:latest ./Frontend
```

**Common Issues:**
- Missing CSS imports (e.g., `react-resizable/css/styles.css`): Install package or comment out import
- Type mismatches: Update type definitions in DTOs and API files
- Unused imports: Remove or use the `@ts-ignore` directive if necessary

### Health Check Failures

```bash
# Check health status
docker inspect openradius-backend --format='{{json .State.Health}}'

# Test health endpoint manually
docker exec openradius-backend curl http://localhost:5000/health

# Disable health check temporarily (in docker-compose.prod.yml)
# Comment out healthcheck section and restart
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean up Docker resources
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Remove stopped containers
docker container prune
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Limit resources in docker-compose.prod.yml
# Add under each service:
#   deploy:
#     resources:
#       limits:
#         cpus: '0.5'
#         memory: 512M

# Restart with new limits
docker-compose -f docker-compose.prod.yml up -d
```

---

## Production Best Practices

### Security
- [ ] Use strong, unique passwords in `.env`
- [ ] Enable SSL/TLS (add nginx reverse proxy)
- [ ] Use Docker secrets for sensitive data
- [ ] Regular security updates: `docker-compose pull && docker-compose up -d`
- [ ] Enable firewall (allow only necessary ports)
- [ ] Use private Docker Hub repositories for proprietary code

### Monitoring
- [ ] Set up container monitoring (Prometheus + Grafana)
- [ ] Configure log aggregation (ELK stack or Loki)
- [ ] Set up alerts for container failures
- [ ] Monitor disk space and resource usage

### Backups
- [ ] Daily database backups (automated cron job)
- [ ] Weekly volume backups
- [ ] Store backups offsite (S3, Azure Blob, etc.)
- [ ] Test restore procedures regularly

### High Availability
- [ ] Run multiple backend instances (load balancer)
- [ ] PostgreSQL replication (primary + replica)
- [ ] Redis cluster for caching
- [ ] Use Docker Swarm or Kubernetes for orchestration

---

## Quick Reference

### Common Commands

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check status
docker-compose -f docker-compose.prod.yml ps

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# Remove everything (including volumes - DANGER!)
docker-compose -f docker-compose.prod.yml down -v
```

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost | Web UI |
| Backend API | http://localhost:5000 | REST API |
| Keycloak | http://localhost:8080 | Identity Management |
| Redpanda Console | http://localhost:8090 | Kafka UI |
| Debezium API | http://localhost:8083 | CDC Management |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |

---

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review this guide's [Troubleshooting](#troubleshooting) section
- Open an issue on GitHub
- Contact your DevOps team

---

**Last Updated:** February 6, 2026  
**Version:** 1.0.0
