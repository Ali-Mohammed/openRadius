# OIDC Quick Reference

## What We Use

✅ **OIDC with Keycloak** as our identity provider  
✅ **OIDC Authorization Code Flow** for authentication  
✅ **PKCE** (Proof Key for Code Exchange) for enhanced security

## Key Endpoints

| Endpoint | URL |
|----------|-----|
| Keycloak Admin | http://localhost:8080 |
| Backend API | http://localhost:5000 |
| Frontend App | http://localhost:5173 |
| OIDC Discovery | http://localhost:8080/realms/openradius/.well-known/openid-configuration |
| Admin Panel OIDC Settings | http://localhost:5173/settings/oidc |

## Default Credentials

### Keycloak Admin Console
- URL: http://localhost:8080
- Username: `admin`
- Password: `admin`

### Test Users

**Administrator**
- Username: `admin`
- Password: `admin123`
- Email: admin@example.com
- Roles: admin, user
- Group: Administrators

**Manager**
- Username: `manager`
- Password: `manager123`
- Email: manager@example.com
- Roles: manager, user
- Group: Managers

## Quick Start

```bash
# 1. Start services
docker-compose up -d

# 2. Run backend
cd Backend
dotnet run

# 3. Run frontend (in new terminal)
cd Frontend
npm run dev
```

## Configuration Files

### Backend: `Backend/appsettings.json`
```json
{
  "Oidc": {
    "Authority": "http://localhost:8080/realms/openradius",
    "ClientId": "openradius-api",
    "Audience": "openradius-api"
  }
}
```

### Frontend: `Frontend/.env`
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
```

## Keycloak Clients

### Backend API Client
- **Client ID**: `openradius-api`
- **Type**: Confidential
- **Flow**: Authorization Code
- **Used for**: Token validation

### Frontend Web Client
- **Client ID**: `openradius-web`
- **Type**: Public
- **Flow**: Authorization Code + PKCE
- **Used for**: User authentication

## API Endpoints

### OIDC Settings API

```http
# Get active OIDC configuration
GET /api/oidcsettings/active
Authorization: Bearer {token}

# Create new OIDC configuration
POST /api/oidcsettings
Authorization: Bearer {token}
Content-Type: application/json

# Update OIDC configuration
PUT /api/oidcsettings/{id}
Authorization: Bearer {token}
Content-Type: application/json

# Test OIDC connection
POST /api/oidcsettings/test
Authorization: Bearer {token}
Content-Type: application/json
```

## Authentication Flow

```
User → Frontend → Keycloak Login → Auth Code → 
Frontend exchanges code for token → 
Backend validates token → Access granted
```

## Token Management

- **Access Token**: 5 min (default)
- **Refresh**: Automatic every 60 seconds
- **Storage**: Memory (not localStorage)
- **Validation**: Signature + Issuer + Expiration

## Troubleshooting

### CORS Error
- Check Keycloak client Web Origins
- Add `http://localhost:5173` to Web Origins

### Invalid Token
- Check Authority URL matches issuer
- Verify metadata endpoint accessible
- Token may be expired

### Redirect Loop
- Verify redirect URIs in Keycloak client
- Check frontend config matches client

### 401 Unauthorized
- Token expired or invalid
- Backend configuration issue
- Check Bearer token in request

## Useful Commands

```bash
# Check Keycloak is running
docker-compose ps

# View Keycloak logs
docker-compose logs keycloak

# Restart Keycloak
docker-compose restart keycloak

# Backend migration
cd Backend
dotnet ef database update

# View backend logs
cd Backend
dotnet run --verbosity detailed
```

## Production Checklist

- [ ] Enable HTTPS everywhere
- [ ] Set `RequireHttpsMetadata: true`
- [ ] Use environment variables for secrets
- [ ] Enable audience validation
- [ ] Configure proper CORS
- [ ] Set secure token lifetimes
- [ ] Enable MFA (optional)
- [ ] Configure email server
- [ ] Set up monitoring
- [ ] Review security settings

## Documentation

- [Full OIDC Documentation](./OIDC_AUTHENTICATION.md)
- [Keycloak Setup Guide](./KEYCLOAK_SETUP.md)
- [Main README](./README.md)

## Support

1. Check documentation
2. Review Keycloak admin console
3. Check browser console for errors
4. Review backend logs
5. Verify all URLs and IDs match
