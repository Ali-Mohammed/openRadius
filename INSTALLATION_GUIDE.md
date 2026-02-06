# OpenRadius Enterprise Installation Guide

## 🚀 Quick Installation

### Prerequisites
- **OS**: Ubuntu 20.04 LTS or newer
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: Minimum 50GB free space
- **Network**: Public IP address
- **Domain**: Registered domain name with DNS access

### One-Command Install

```bash
# Download and run installation script
curl -fsSL https://raw.githubusercontent.com/Ali-Mohammed/openRadius/main/install-openradius.sh | bash
```

### Manual Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/Ali-Mohammed/openRadius.git
   cd openRadius
   ```

2. **Run Installation Script**
   ```bash
   chmod +x install-openradius.sh
   ./install-openradius.sh
   ```

## 📋 Installation Process

The script will:

### 1. System Check
- ✅ Verify Ubuntu OS
- ✅ Check sudo privileges
- ✅ Verify system requirements

### 2. Install Dependencies
- ✅ Docker Engine (latest)
- ✅ Docker Compose Plugin
- ✅ System utilities (curl, wget, git, openssl)
- ✅ Certbot for SSL certificates
- ✅ UFW firewall

### 3. Configure Firewall
- ✅ Enable UFW
- ✅ Allow SSH (port 22)
- ✅ Allow HTTP (port 80)
- ✅ Allow HTTPS (port 443)

### 4. Collect Configuration
You will be prompted for:

#### Domain Configuration
```
Enter your domain name (e.g., example.com): yourdomain.com
Enter your email for SSL certificates: admin@yourdomain.com
```

#### Password Configuration
Choose between:
- **Option 1**: Auto-generate secure passwords (recommended)
- **Option 2**: Enter custom passwords

If choosing custom passwords, you'll be prompted for:
- PostgreSQL password (min 16 characters)
- Keycloak admin password (min 16 characters)
- Redis password (min 16 characters)

#### Additional Options
```
Install sample data? [y/N]: n
Enable automated backups? [Y/n]: y
```

### 5. DNS Configuration
The script will display DNS records you need to configure:

```
A Record:
  yourdomain.com  →  YOUR_SERVER_IP

CNAME Records:
  api.yourdomain.com      →  yourdomain.com
  auth.yourdomain.com     →  yourdomain.com
  logs.yourdomain.com     →  yourdomain.com
  kafka.yourdomain.com    →  yourdomain.com
  cdc.yourdomain.com      →  yourdomain.com
```

### 6. SSL Certificates
- ✅ Generate Let's Encrypt certificates (if DNS configured)
- ✅ Or create self-signed certificates for testing
- ✅ Set up auto-renewal (daily check)

### 7. Deploy Services
- ✅ Pull Docker images
- ✅ Start all services
- ✅ Wait for health checks
- ✅ Verify deployment

### 8. Configure Backups (Optional)
- ✅ Create backup script
- ✅ Schedule daily backups at 2:00 AM
- ✅ Retain backups for 30 days

## 🔑 Generated Credentials

After installation, you'll receive a credentials file:

**Location**: `openradius-credentials-YYYYMMDD-HHMMSS.txt`

**Contents**:
```
Domain: yourdomain.com
SSL Email: admin@yourdomain.com

PostgreSQL:
  - Database: openradius
  - Username: openradius
  - Password: [auto-generated]

Keycloak Admin:
  - URL: https://auth.yourdomain.com/admin
  - Username: admin
  - Password: [auto-generated]

Redis:
  - Password: [auto-generated]

Seq:
  - URL: https://logs.yourdomain.com
  - API Key: [auto-generated]

Switch Decryption Key: [auto-generated]
```

**⚠️ IMPORTANT**: 
- Store credentials securely (password manager recommended)
- Delete the credentials file from the server after saving
- Never commit credentials to version control

## 🌐 Service URLs

After installation, access services at:

| Service | URL | Description |
|---------|-----|-------------|
| **Main App** | https://yourdomain.com | Frontend Application |
| **API** | https://api.yourdomain.com | Backend REST API |
| **Keycloak** | https://auth.yourdomain.com | Authentication Server |
| **Keycloak Admin** | https://auth.yourdomain.com/admin | Admin Console |
| **Seq Logs** | https://logs.yourdomain.com | Structured Logging |
| **Kafka Console** | https://kafka.yourdomain.com | Message Broker UI |
| **Debezium** | https://cdc.yourdomain.com | Change Data Capture |

## 📊 Verify Installation

### 1. Check Service Status
```bash
cd /opt/openradius
docker compose -f docker-compose.prod.yml ps
```

All services should show "Up (healthy)".

### 2. View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### 3. Test URLs
```bash
# Frontend
curl -I https://yourdomain.com

# API Health
curl https://api.yourdomain.com/health

# Keycloak
curl https://auth.yourdomain.com/realms/openradius/.well-known/openid-configuration
```

### 4. Check SSL Certificates
```bash
# Verify certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com < /dev/null | grep "Verify return code"

# Should show: Verify return code: 0 (ok)
```

## 🔧 Post-Installation Steps

### 1. Configure Keycloak

Access Keycloak admin console:
```
URL: https://auth.yourdomain.com/admin
Username: admin
Password: [from credentials file]
```

**Create OpenRadius Realm**:
1. Click "Create Realm"
2. Name: `openradius`
3. Enable: ✅

**Create Client**:
1. Clients → Create
2. Client ID: `openradius-api`
3. Client Protocol: `openid-connect`
4. Access Type: `confidential`
5. Valid Redirect URIs: `https://yourdomain.com/*`
6. Save

### 2. Set Up Users

In Keycloak:
1. Go to Users
2. Create admin user
3. Set credentials
4. Assign roles

### 3. Test Authentication

1. Open https://yourdomain.com
2. Click Login
3. Should redirect to Keycloak
4. Enter credentials
5. Should redirect back to app

### 4. Configure Monitoring

View logs in Seq:
```
URL: https://logs.yourdomain.com
API Key: [from credentials file]
```

### 5. Review Kafka Topics

Access Redpanda Console:
```
URL: https://kafka.yourdomain.com
```

## 📦 Backup & Restore

### Manual Backup
```bash
/opt/openradius/backup-openradius.sh
```

**Backup Location**: `/opt/openradius-backups/`

**Backup Contents**:
- Database dump
- Docker volumes
- Configuration files

### Restore from Backup
```bash
# Stop services
cd /opt/openradius
docker compose -f docker-compose.prod.yml down

# Restore database
gunzip < /opt/openradius-backups/db-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U openradius -d openradius

# Restore volumes
docker run --rm \
  -v openradius-postgres-data:/data \
  -v /opt/openradius-backups:/backup \
  alpine tar xzf /backup/volumes-YYYYMMDD-HHMMSS.tar.gz -C /

# Start services
docker compose -f docker-compose.prod.yml up -d
```

## 🔄 Updates

### Update Application
```bash
cd /opt/openradius

# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### Update System
```bash
# Update OS packages
sudo apt update && sudo apt upgrade -y

# Update Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io
```

## 🛠️ Common Commands

### Service Management
```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# Restart service
docker compose -f docker-compose.prod.yml restart backend

# View status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Scale service
docker compose -f docker-compose.prod.yml up -d --scale backend=3
```

### Database Access
```bash
# Connect to PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U openradius

# Run query
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U openradius -d openradius -c "SELECT * FROM users LIMIT 10;"
```

### Redis Access
```bash
# Connect to Redis
docker compose -f docker-compose.prod.yml exec redis redis-cli -a YOUR_REDIS_PASSWORD

# Check keys
docker compose -f docker-compose.prod.yml exec redis redis-cli -a YOUR_REDIS_PASSWORD KEYS '*'
```

## 🚨 Troubleshooting

### Services Not Starting

**Check logs**:
```bash
docker compose -f docker-compose.prod.yml logs backend
```

**Check Docker**:
```bash
docker ps -a
docker system df
```

### SSL Certificate Issues

**Renew manually**:
```bash
sudo certbot renew --force-renewal
docker compose -f docker-compose.prod.yml restart nginx
```

**Check certificate expiry**:
```bash
sudo certbot certificates
```

### Database Connection Errors

**Verify PostgreSQL**:
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U openradius
```

**Check connection string** in `.env` file.

### High Resource Usage

**Check resource usage**:
```bash
docker stats
```

**Increase resources**:
Edit `docker-compose.prod.yml` to add resource limits.

## 🔒 Security Best Practices

### 1. Change Default Passwords
After installation, change all auto-generated passwords in Keycloak and database.

### 2. Enable IP Whitelisting
Edit `nginx/nginx.conf.template` to restrict admin interfaces:
```nginx
# Uncomment and configure
allow 1.2.3.4;  # Your IP
deny all;
```

### 3. Configure Fail2Ban
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 4. Regular Updates
```bash
# Update weekly
sudo apt update && sudo apt upgrade -y
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### 5. Monitor Logs
Regularly check Seq at https://logs.yourdomain.com for:
- Failed login attempts
- API errors
- Unusual traffic patterns

## 📞 Support

For issues or questions:
1. Check logs: `docker compose -f docker-compose.prod.yml logs`
2. Review [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)
3. Consult [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)
4. See [NGINX_PROXY_GUIDE.md](NGINX_PROXY_GUIDE.md)

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx Documentation](https://nginx.org/en/docs/)
