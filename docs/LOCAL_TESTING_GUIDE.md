# OpenRadius - Local Testing Guide

## 🎯 Quick Start

Test the entire OpenRadius stack locally with nginx reverse proxy:

```bash
# Start the stack
docker-compose -f docker-compose.local.yml up -d

# Check status
docker-compose -f docker-compose.local.yml ps

# View logs
docker-compose -f docker-compose.local.yml logs -f
```

## 🌐 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Main App** | http://localhost | Frontend Application |
| **API** | http://localhost:5000 | Backend REST API |
| **API Health** | http://localhost:5000/health | Health Check |
| **SignalR** | ws://localhost:5000/hubs | WebSocket Hub |
| **Keycloak** | http://localhost:8080 | Authentication Server |
| **Keycloak Admin** | http://localhost:8080/admin | Admin Console |
| **Seq Logs** | http://localhost:5341 | Structured Logging UI |
| **Redpanda Console** | http://localhost:8090 | Kafka Management UI |
| **Debezium API** | http://localhost:8083 | CDC Connector API |

## 📋 Environment Setup

### Option 1: Use Default Values
The local setup works out-of-the-box with default development credentials.

### Option 2: Custom Environment
Create a `.env` file:

```bash
# Database
POSTGRES_PASSWORD=my_local_password

# Keycloak
KEYCLOAK_ADMIN_PASSWORD=my_admin_password

# Redis
REDIS_PASSWORD=my_redis_password

# Seq
SEQ_API_KEY=my_seq_api_key

# Switch Decryption
SWITCH_DECRYPTION_KEY=0123456789ABCDEF0123456789ABCDEF
```

## 🔧 Default Credentials

### Keycloak Admin
- **URL**: http://localhost:8080/admin
- **Username**: `admin`
- **Password**: `admin123` (or your KEYCLOAK_ADMIN_PASSWORD)

### PostgreSQL
- **Host**: localhost:5432 (exposed for debugging)
- **Database**: `openradius`
- **Username**: `openradius`
- **Password**: `dev_password_change_me` (or your POSTGRES_PASSWORD)

### Redis
- **Host**: localhost:6379 (exposed for debugging)
- **Password**: `dev_redis_password` (or your REDIS_PASSWORD)

## ✅ Testing the Stack

### 1. Check All Services Are Running
```bash
docker-compose -f docker-compose.local.yml ps
```

All services should show status as "Up (healthy)".

### 2. Test Frontend
```bash
curl http://localhost
# Should return HTML
```

### 3. Test API Health
```bash
curl http://localhost:5000/health
# Should return: Healthy
```

### 4. Test Keycloak
```bash
curl http://localhost:8080/realms/openradius/.well-known/openid-configuration
# Should return OIDC configuration JSON
```

### 5. Test Nginx Proxy
```bash
# Check nginx configuration
docker-compose -f docker-compose.local.yml exec nginx nginx -t

# View nginx logs
docker-compose -f docker-compose.local.yml logs nginx
```

### 6. Test Seq Logging
Open http://localhost:5341 in your browser. You should see the Seq UI.

### 7. Test Redpanda Console
Open http://localhost:8090 in your browser. You should see Kafka topics.

## 📊 Monitoring

### View Logs
```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f backend
docker-compose -f docker-compose.local.yml logs -f nginx
docker-compose -f docker-compose.local.yml logs -f keycloak

# Last 50 lines
docker-compose -f docker-compose.local.yml logs --tail=50 backend
```

### Check Service Health
```bash
# Backend health
curl http://localhost:5000/health

# Keycloak health
curl http://localhost:8080/health/ready

# Nginx status
docker-compose -f docker-compose.local.yml exec nginx nginx -s reload
```

### View Nginx Logs
```bash
# Access logs
docker-compose -f docker-compose.local.yml exec nginx tail -f /var/log/nginx/api-access.log
docker-compose -f docker-compose.local.yml exec nginx tail -f /var/log/nginx/frontend-access.log

# Error logs
docker-compose -f docker-compose.local.yml exec nginx tail -f /var/log/nginx/api-error.log
```

## 🔍 Troubleshooting

### Services Not Starting

**Check Docker resources:**
```bash
docker system df
docker system prune -a --volumes  # WARNING: This removes ALL unused data
```

**Check individual service logs:**
```bash
docker-compose -f docker-compose.local.yml logs postgres
docker-compose -f docker-compose.local.yml logs keycloak
docker-compose -f docker-compose.local.yml logs backend
```

### Database Connection Issues

**Check PostgreSQL is ready:**
```bash
docker-compose -f docker-compose.local.yml exec postgres pg_isready -U openradius
```

**Connect to database:**
```bash
docker-compose -f docker-compose.local.yml exec postgres psql -U openradius -d openradius
```

### Nginx 502 Bad Gateway

**Check backend is running:**
```bash
docker-compose -f docker-compose.local.yml ps backend
curl http://localhost:5000/health
```

**Check nginx can reach backend:**
```bash
docker-compose -f docker-compose.local.yml exec nginx wget -O- http://backend:5000/health
```

### Keycloak Not Ready

Keycloak takes ~60 seconds to start. Wait for health check:
```bash
docker-compose -f docker-compose.local.yml logs -f keycloak
# Wait for: "Keycloak 24.0 started"
```

### Frontend Shows Blank Page

**Check browser console** for API errors.

**Verify API is accessible:**
```bash
curl http://localhost:5000/health
```

**Check nginx proxy:**
```bash
docker-compose -f docker-compose.local.yml exec nginx nginx -t
```

## 🔄 Restart Services

```bash
# Restart specific service
docker-compose -f docker-compose.local.yml restart backend
docker-compose -f docker-compose.local.yml restart nginx

# Restart all services
docker-compose -f docker-compose.local.yml restart

# Rebuild and restart
docker-compose -f docker-compose.local.yml up -d --build backend
```

## 🧹 Cleanup

### Stop Services
```bash
docker-compose -f docker-compose.local.yml down
```

### Stop and Remove Volumes
```bash
# WARNING: This deletes all data
docker-compose -f docker-compose.local.yml down -v
```

### Remove Images
```bash
docker-compose -f docker-compose.local.yml down --rmi all
```

## 🚀 Development Workflow

### 1. Start Stack
```bash
docker-compose -f docker-compose.local.yml up -d
```

### 2. Make Code Changes
Edit your code as needed.

### 3. Rebuild & Deploy
```bash
# Rebuild backend
docker build -t alimohammed/openradius-backend:latest ./Backend
docker-compose -f docker-compose.local.yml up -d --no-deps backend

# Rebuild frontend
docker build -t alimohammed/openradius-frontend:latest ./Frontend
docker-compose -f docker-compose.local.yml up -d --no-deps frontend
```

### 4. View Changes
Refresh http://localhost in your browser.

## 📈 Performance Testing

### Load Test API
```bash
# Install apache bench (if not installed)
brew install httpd  # macOS

# Test API endpoint
ab -n 1000 -c 10 http://localhost:5000/health

# Test with authentication
ab -n 1000 -c 10 -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/users
```

### Monitor Resource Usage
```bash
# Real-time container stats
docker stats

# Specific services
docker stats openradius-backend-local openradius-frontend-local
```

## 🔐 Security Notes

⚠️ **This configuration is for LOCAL TESTING ONLY**

- Default passwords are used
- No SSL/TLS encryption
- No rate limiting enforced
- Admin interfaces are publicly accessible
- Suitable for development, NOT production

## 📝 Next Steps

After local testing succeeds:

1. ✅ Configure production domain
2. ✅ Generate SSL certificates
3. ✅ Update environment variables with secure passwords
4. ✅ Use `docker-compose.prod.yml` for production
5. ✅ Follow [NGINX_PROXY_GUIDE.md](NGINX_PROXY_GUIDE.md) for production setup

## 🆘 Getting Help

If you encounter issues:

1. Check service logs: `docker-compose -f docker-compose.local.yml logs -f`
2. Verify all services are healthy: `docker-compose -f docker-compose.local.yml ps`
3. Check Seq logs at http://localhost:5341
4. Review [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)
5. Consult [NGINX_PROXY_GUIDE.md](NGINX_PROXY_GUIDE.md)

## 📚 Additional Resources

- **Main README**: [README.md](README.md)
- **Docker Deployment**: [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md)
- **Nginx Proxy Setup**: [NGINX_PROXY_GUIDE.md](NGINX_PROXY_GUIDE.md)
- **Production Environment**: [PRODUCTION_ENV_GUIDE.md](PRODUCTION_ENV_GUIDE.md)
- **Enterprise Guide**: [ENTERPRISE_PRODUCTION_GUIDE.md](ENTERPRISE_PRODUCTION_GUIDE.md)
