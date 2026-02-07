# =============================================================================
# OpenRadius - Nginx Reverse Proxy Setup Guide
# =============================================================================

## Overview

The nginx reverse proxy provides:
- ✅ Single HTTPS entry point (port 443)
- ✅ Domain-based routing for all services
- ✅ SSL/TLS termination
- ✅ Rate limiting and security
- ✅ Internal service protection
- ✅ Enterprise-grade architecture

## Domain Structure

| Service | Domain | Purpose |
|---------|--------|---------|
| **Frontend** | `https://yourdomain.com` | Main application |
| **Backend API** | `https://api.yourdomain.com` | REST API + SignalR |
| **Keycloak** | `https://auth.yourdomain.com` | Authentication |
| **Seq Logs** | `https://logs.yourdomain.com` | Log management (internal) |
| **Kafka Console** | `https://kafka.yourdomain.com` | Redpanda UI (internal) |
| **Debezium** | `https://cdc.yourdomain.com` | CDC API (internal) |

## Quick Setup

### 1. Configure Domain

```bash
# Edit .env file
nano .env

# Add your domain
DOMAIN=yourdomain.com
```

### 2. DNS Configuration

Point these DNS records to your server IP:

```dns
A     yourdomain.com        -> YOUR_SERVER_IP
CNAME api.yourdomain.com    -> yourdomain.com
CNAME auth.yourdomain.com   -> yourdomain.com
CNAME logs.yourdomain.com   -> yourdomain.com
CNAME kafka.yourdomain.com  -> yourdomain.com
CNAME cdc.yourdomain.com    -> yourdomain.com
```

### 3. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com \
  -d api.yourdomain.com \
  -d auth.yourdomain.com \
  -d logs.yourdomain.com \
  -d kafka.yourdomain.com \
  -d cdc.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
```

#### Option B: Self-Signed (Development)

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"
```

### 4. Prepare Nginx Configuration

```bash
# Create nginx directory structure
mkdir -p nginx/ssl nginx/certbot

# Copy nginx configuration
cp nginx/nginx.conf.template nginx/nginx.conf

# The DOMAIN variable will be substituted from .env automatically
```

### 5. Update OIDC Configuration

```bash
# Edit .env file
nano .env

# Update OIDC URLs for external access
OIDC_AUTHORITY=https://auth.yourdomain.com/realms/openradius
OIDC_METADATA_ADDRESS=https://auth.yourdomain.com/realms/openradius/.well-known/openid-configuration
OIDC_ISSUER=https://auth.yourdomain.com/realms/openradius
```

### 6. Deploy

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx
```

## Security Features

### Rate Limiting

```nginx
# API: 10 requests/second per IP
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Auth: 5 requests/second per IP
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

# General: 20 requests/second per IP
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=20r/s;
```

### IP Whitelisting (Internal Services)

Uncomment in `nginx/nginx.conf` for internal-only access:

```nginx
# Restrict to internal IPs only
allow 10.0.0.0/8;
allow 172.16.0.0/12;
allow 192.168.0.0/16;
deny all;
```

### Security Headers

All responses include:
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options` (clickjacking protection)
- `X-Content-Type-Options` (MIME sniffing protection)
- `X-XSS-Protection` (XSS protection)
- `Referrer-Policy` (referrer control)

## Testing

### Test Domain Resolution

```bash
# Test main domain
curl -I https://yourdomain.com

# Test API
curl -I https://api.yourdomain.com/health

# Test Auth
curl -I https://auth.yourdomain.com/health
```

### Test SSL Certificate

```bash
# Check certificate
openssl s_client -connect yourdomain.com:443 -showcerts

# Check all SANs
openssl s_client -connect yourdomain.com:443 2>/dev/null | \
  openssl x509 -noout -text | grep DNS
```

### Check Nginx Configuration

```bash
# Test nginx config syntax
docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Reload nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Monitoring

### View Access Logs

```bash
# All access logs
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/*-access.log

# API access only
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/api-access.log

# Frontend access only
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/frontend-access.log
```

### View Error Logs

```bash
# All errors
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/*-error.log

# Specific service errors
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/api-error.log
```

## Troubleshooting

### SSL Certificate Not Found

```bash
# Check SSL files exist
ls -la nginx/ssl/
# Should show: cert.pem and key.pem

# Check permissions
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem
```

### DNS Not Resolving

```bash
# Test DNS
nslookup api.yourdomain.com
dig api.yourdomain.com

# Check /etc/hosts (local testing)
echo "127.0.0.1 yourdomain.com api.yourdomain.com" | sudo tee -a /etc/hosts
```

### 502 Bad Gateway

```bash
# Check backend service is running
docker-compose -f docker-compose.prod.yml ps backend

# Check backend health
docker-compose -f docker-compose.prod.yml exec backend curl http://localhost:5000/health

# Check nginx can reach backend
docker-compose -f docker-compose.prod.yml exec nginx ping backend
```

### Rate Limiting Issues

```bash
# Temporarily disable rate limiting
# Comment out limit_req lines in nginx/nginx.conf

# Reload nginx
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Advanced Configuration

### Add Custom Domain

1. Add DNS record
2. Update certificate to include new domain
3. Add server block in `nginx/nginx.conf`
4. Reload nginx

### Enable HTTP/3 (QUIC)

```nginx
server {
    listen 443 ssl http2;
    listen 443 quic;  # Add this
    
    # Add header
    add_header Alt-Svc 'h3=":443"; ma=86400';
}
```

### Add Basic Authentication

```bash
# Install htpasswd
sudo apt-get install apache2-utils

# Create password file
htpasswd -c nginx/htpasswd admin

# Add to nginx location
location / {
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/htpasswd;
}
```

## Automatic SSL Renewal

### Certbot Renewal Setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line (runs daily at 2am)
0 2 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/nginx/ssl/cert.pem && \
  cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /path/to/nginx/ssl/key.pem && \
  docker-compose -f /path/to/docker-compose.prod.yml exec nginx nginx -s reload
```

## Benefits Summary

### Security
- ✅ All traffic encrypted (HTTPS)
- ✅ Internal services not exposed
- ✅ Rate limiting prevents abuse
- ✅ IP whitelisting for sensitive services
- ✅ Security headers enabled

### Performance
- ✅ HTTP/2 enabled
- ✅ Connection keep-alive
- ✅ Gzip compression
- ✅ SSL session caching

### Maintainability
- ✅ Centralized logging
- ✅ Single entry point
- ✅ Easy SSL management
- ✅ Domain-based routing

### Scalability
- ✅ Load balancing ready
- ✅ Easy to add services
- ✅ Horizontal scaling support

---

**Last Updated:** February 6, 2026  
**Version:** 1.0.0
