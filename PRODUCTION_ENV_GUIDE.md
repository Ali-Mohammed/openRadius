# Production Deployment with Docker Compose

This guide explains how to deploy OpenRadius to production using Docker Compose with environment variables.

## Quick Start

### 1. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your production values
nano .env  # or vim, code, etc.
```

### 2. Set Required Variables

**Minimum Required Configuration:**

```env
# .env file
POSTGRES_PASSWORD=your_secure_postgres_password_here
KEYCLOAK_ADMIN_PASSWORD=your_secure_keycloak_admin_password
REDIS_PASSWORD=your_secure_redis_password
SWITCH_DECRYPTION_KEY=your_actual_switch_key_in_hex_format
```

### 3. Deploy the Stack

```bash
# Pull latest images from Docker Hub
docker-compose -f docker-compose.prod.yml pull

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Verify Deployment

```bash
# Check all containers are healthy
docker-compose -f docker-compose.prod.yml ps

# Should show all services as "healthy" or "running"
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL admin password | `MySecureP@ssw0rd123` |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin console password | `KeycloakAdmin123` |
| `REDIS_PASSWORD` | Redis authentication password | `RedisSecure456` |
| `SWITCH_DECRYPTION_KEY` | Switch decryption key (hex) | `0123456789ABCDEF...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SEQ_API_KEY` | Seq logging API key | (empty - no auth) |
| `BACKEND_VERSION` | Backend image version | `latest` |
| `FRONTEND_VERSION` | Frontend image version | `latest` |

## How Docker Compose Loads .env

Docker Compose **automatically** loads `.env` from the same directory:

```bash
# These commands automatically use .env file
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml logs
```

**Variable Substitution:**
```yaml
# In docker-compose.prod.yml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-admin123}
  #                  ↑ Uses .env value
  #                                    ↑ Fallback if not set
```

## Security Best Practices

### 1. Never Commit .env to Git

The `.env` file is already in `.gitignore`. **Never remove it!**

```bash
# ✅ SAFE - Committed to git (template)
.env.example

# ❌ DANGEROUS - Should NEVER be in git
.env
```

### 2. Use Strong Passwords

```bash
# Generate secure passwords
openssl rand -base64 32  # For passwords
openssl rand -hex 32     # For keys
```

### 3. Restrict File Permissions

```bash
# Only owner can read .env file
chmod 600 .env

# Verify permissions
ls -la .env
# Should show: -rw-------
```

### 4. Use Docker Secrets (Advanced)

For production, consider Docker Swarm secrets:

```yaml
# docker-compose.prod.yml (Swarm mode)
secrets:
  postgres_password:
    external: true

services:
  postgres:
    secrets:
      - postgres_password
```

## Production Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Set all required environment variables
- [ ] Use strong, unique passwords (min 16 characters)
- [ ] Set file permissions: `chmod 600 .env`
- [ ] **Never** commit `.env` to git
- [ ] Document password storage location (password manager)
- [ ] Set up automated backups
- [ ] Configure monitoring and alerts
- [ ] Test disaster recovery procedures

## Accessing Services

After deployment, services are available at:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost | Keycloak users |
| **Backend API** | http://localhost:5000 | API endpoints |
| **Keycloak Admin** | http://localhost:8080 | admin / ${KEYCLOAK_ADMIN_PASSWORD} |
| **Seq Logs** | http://localhost:5341 | No auth (default) |
| **Redpanda Console** | http://localhost:8090 | No auth |
| **Debezium API** | http://localhost:8083 | REST API |

## Updating Environment Variables

### Method 1: Edit and Restart

```bash
# 1. Edit .env file
nano .env

# 2. Recreate affected containers
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# 3. Verify changes
docker-compose -f docker-compose.prod.yml exec backend env | grep POSTGRES
```

### Method 2: Inline Override

```bash
# Temporary override (not recommended for production)
POSTGRES_PASSWORD=new_password docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Environment Variables Not Loading

```bash
# Check if .env file exists
ls -la .env

# Verify Docker Compose can read it
docker-compose -f docker-compose.prod.yml config | grep POSTGRES_PASSWORD
# Should show your password value (be careful - this exposes secrets!)
```

### Container Won't Start

```bash
# Check logs for specific container
docker-compose -f docker-compose.prod.yml logs backend

# Common issues:
# - Missing required environment variable
# - Invalid password format
# - Incorrect connection string
```

### Password Change

```bash
# 1. Stop services
docker-compose -f docker-compose.prod.yml down

# 2. Update .env file
nano .env

# 3. Remove volumes (if database password changed)
docker volume rm openradius_postgres_data  # CAUTION: Deletes data!

# 4. Restart
docker-compose -f docker-compose.prod.yml up -d
```

## Backup and Restore

### Backup .env File

```bash
# Encrypt and backup .env
gpg --symmetric --cipher-algo AES256 .env
# Creates .env.gpg (encrypted)

# Store .env.gpg in secure backup location
```

### Restore .env File

```bash
# Decrypt .env
gpg --decrypt .env.gpg > .env
chmod 600 .env
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
- name: Create .env file
  run: |
    cat << EOF > .env
    POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
    KEYCLOAK_ADMIN_PASSWORD=${{ secrets.KEYCLOAK_ADMIN_PASSWORD }}
    REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}
    SWITCH_DECRYPTION_KEY=${{ secrets.SWITCH_DECRYPTION_KEY }}
    EOF
    chmod 600 .env
```

### GitLab CI Example

```yaml
# .gitlab-ci.yml
deploy:
  script:
    - echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" > .env
    - echo "KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD}" >> .env
    - chmod 600 .env
    - docker-compose -f docker-compose.prod.yml up -d
```

## Support

For issues or questions:
- Check logs: `docker-compose -f docker-compose.prod.yml logs -f`
- Verify environment: `docker-compose -f docker-compose.prod.yml config`
- Review [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)
- Open an issue on GitHub

---

**Last Updated:** February 6, 2026  
**Version:** 1.0.0
