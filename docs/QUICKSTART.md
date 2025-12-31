# OpenRadius - Quick Start Guide

## Automated Setup (Recommended)

### Windows
```powershell
.\start.ps1
```

### Linux/Mac
```bash
chmod +x start.sh
./start.sh
```

This will automatically:
1. Start PostgreSQL and Keycloak containers
2. **Auto-import Keycloak realm configuration** (instant setup!)
3. Start Backend (ASP.NET Core)
4. Start Frontend (React + Vite)

The Keycloak realm is imported from `keycloak-realm-export.json` - no manual configuration needed!

**Pre-configured:**
- ✅ Realm: `openradius`
- ✅ Client: `openradius-web` (OIDC)
- ✅ Test users: `testuser/testuser123`, `admin/admin123`

**Usage:**
1. Open http://localhost:5173
2. Login with `testuser` / `testuser123`
3. Go to **Settings → OIDC Providers**
4. Add provider:
   - Provider Name: `keycloak`
   - Display Name: `Login with Keycloak`
   - Authority: `http://localhost:8080/realms/openradius`
   - Client ID: `openradius-web`
   - Click **Test Connection** then **Create Provider**
   - Toggle **Active** to ON
5. Logout and test login flow!

## Manual Setup

### 1. Start Docker Services
```bash
docker-compose up -d
```

### 2. Configure Keycloak (Option A: Script)

**Windows:**
```powershell
.\setup-keycloak.ps1
```

**Linux/Mac:**
```bash
chmod +x setup-keycloak.sh
./setup-keycloak.sh
```

### 2. Configure Keycloak (Option B: Manual)
Follow instructions in [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md)

### 3. Start Backend
```bash
cd Backend
dotnet run
```

### 4. Start Frontend
```bash
cd Frontend
pnpm dev
```

## Verify Keycloak Auto-Configuration

Check if Keycloak was configured successfully:
```bash
docker logs openradius-keycloak-init
```

You should see:
- ✓ Realm created
- ✓ Client created  
- ✓ User created
- ✓ Password set

## Services

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000
- **Keycloak:** http://localhost:8080
- **PostgreSQL:** localhost:5432

## Test Credentials

- **User:** testuser / testuser123
- **Admin:** admin / admin123
- **Keycloak Admin:** admin / admin (for Keycloak console)

## Keycloak Configuration

The realm is automatically imported from `keycloak-realm-export.json`. This file contains:
- Realm configuration
- OIDC client settings
- Test users with passwords
- Security policies

To modify the default configuration, edit `keycloak-realm-export.json` before starting.

## Stopping Services

### Windows
```powershell
docker-compose down
# Stop backend/frontend terminals manually (Ctrl+C)
```
Realm Not Imported
```bash
# Check Keycloak logs
docker logs openradius-keycloak

# Restart with fresh import
docker-compose down -v
docker-compose up -d
```

### Modify Keycloak Configuration
Edit `keycloak-realm-export.json` and restart:
```bash
docker-compose restart keycloak
```

## Troubleshooting

### Keycloak Init Failed
```bash
# Check logs
docker logs openradius-keycloak-init

# Retry manually
docker-compose restart keycloak-init
```

### Port Already in Use
```bash
# Check what's using the ports
netstat -ano | findstr :5173  # Frontend
netstat -ano | findstr :5000  # Backend
netstat -ano | findstr :8080  # Keycloak
netstat -ano | findstr :5432  # PostgreSQL

# Kill the process or change ports in configuration
```

### Reset Everything
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d --build  # Rebuild and restart
```

## Next Steps

After successful setup:
1. Explore the admin panel (Settings → OIDC Providers)
2. Add additional providers (Azure AD, Google)
3. Configure user roles and permissions
4. Customize the application

For detailed OIDC configuration, see [OIDC_CONFIGURATION.md](OIDC_CONFIGURATION.md)
