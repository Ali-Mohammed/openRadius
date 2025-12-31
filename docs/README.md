# OpenRadius

Enterprise-grade full-stack application with ASP.NET Core 10 backend, React 19 frontend, **OIDC Authentication with Keycloak**, PostgreSQL database, and Docker.

## 🔐 Authentication

**We use OpenID Connect (OIDC) with Keycloak as our identity provider.**

- ✅ OIDC Authorization Code Flow for secure authentication
- ✅ PKCE (Proof Key for Code Exchange) for enhanced security
- ✅ Automatic token refresh
- ✅ Enterprise-grade identity and access management
- ✅ Configurable OIDC provider from admin panel

See [OIDC_AUTHENTICATION.md](OIDC_AUTHENTICATION.md) for detailed documentation.

## Tech Stack

### Backend
- ASP.NET Core 10 Web API
- Entity Framework Core
- PostgreSQL
- **OIDC/JWT Authentication** with Keycloak

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui components
- **Keycloak JS client** (OIDC)
- React Router v7
- Axios

### Infrastructure
- Docker & Docker Compose
- PostgreSQL 16
- **Keycloak 26.4** (OIDC Provider)

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) or Docker Engine (Linux)
- [pnpm](https://pnpm.io/) - `npm install -g pnpm`

## 🚀 Quick Start (All Platforms)

### Automated Setup (Recommended)

#### Windows (PowerShell)
```powershell
.\start.ps1
```

#### Linux / macOS / WSL
```bash
chmod +x start.sh
./start.sh
```

This automatically:
- ✅ Starts PostgreSQL + Keycloak containers
- ✅ Auto-configures Keycloak (realm, client, test user)
- ✅ Starts Backend (ASP.NET Core)
- ✅ Starts Frontend (React + Vite)

**Wait 1-2 minutes** for Keycloak initialization, then:
1. Open http://localhost:5173
2. Login: `testuser` / `testuser123`
3. Go to **Settings → OIDC Providers**
4. Add provider (details shown after startup)
5. Test login flow!

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

## Getting Started (Manual)

### Quick Setup

1. **Start Services**: 
   ```bash
   docker-compose up -d
   ```
2. **Configure Keycloak**: Follow [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md)
3. **Run Backend**: `cd Backend && dotnet run`
4. **Run Frontend**: `cd Frontend && npm run dev`

### Detailed Setup

### 1. Start Docker Services

Start PostgreSQL and Keycloak (OIDC Provider):

```powershell
docker-compose up -d
```

Wait for services to be ready (about 30-60 seconds). Check status:

```powershell
docker-compose ps
```

### 2. Configure Keycloak (OIDC Provider)

**Follow the comprehensive guide**: [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md)

**Quick steps**:

1. Open Keycloak Admin Console: http://localhost:8080
2. Login: `admin` / `admin`
3. Create realm: `openradius`
4. Create backend client: `openradius-api` (confidential)
5. Create frontend client: `openradius-web` (public, with PKCE)
6. Create test user with credentials

**Important Client Configuration**:
- Backend client (`openradius-api`): Confidential with client secret
- Frontend client (`openradius-web`): Public with Authorization Code Flow + PKCE
- Valid redirect URIs: `http://localhost:5173/*`
- Web origins: `http://localhost:5173`

### 3. Run Backend

```powershell
cd Backend
dotnet restore
dotnet ef migrations add InitialCreate
dotnet ef database update
dotnet run
```

Backend will run on http://localhost:5000
Swagger UI: http://localhost:5000/swagger

### 4. Run Frontend

Open a new terminal:

```powershell
cd Frontend
npm install
npm run dev
```

Frontend will run on http://localhost:5173

## Features

### 🔐 Enterprise Authentication
- **OIDC Authentication** with Keycloak
- Authorization Code Flow with PKCE
- Automatic token refresh
- Secure session management
- Single Sign-On (SSO) support

### ⚙️ OIDC Admin Panel
- Configure OIDC provider settings from UI
- Test OIDC provider connectivity
- Manage multiple OIDC configurations
- Switch between different providers
- Real-time configuration updates

### 🎨 Modern UI
- React 19 with TypeScript
- Tailwind CSS styling
- shadcn/ui components
- Dark/Light theme support
- Responsive design
- Internationalization (i18n)

### 🚀 Backend API
- ASP.NET Core 10
- Entity Framework Core
- PostgreSQL database
- Swagger documentation
- JWT token validation
- RESTful API design

## Usage

1. Navigate to http://localhost:5173
2. Click "Login" button
3. Login with Keycloak credentials (e.g., testuser)
4. You'll be redirected to the Dashboard

### Admin Panel Features

**OIDC Settings** (`/settings/oidc`):
- View current OIDC provider configuration
- Update Authority, Client ID, and other settings
- Test connectivity to OIDC provider
- Configure scopes and response types
- Manage token validation settings

## Project Structure

```
OpenRadius/
├── Backend/                    # ASP.NET Core API
│   ├── Controllers/           # API Controllers
│   │   ├── OidcSettingsController.cs  # OIDC configuration API
│   │   ├── UsersController.cs
│   │   └── InstantController.cs
│   ├── Data/                  # DbContext
│   ├── Models/                # Domain models
│   │   ├── OidcSettings.cs   # OIDC configuration model
│   │   ├── User.cs
│   │   └── Instant.cs
│   ├── Migrations/            # EF Core migrations
│   ├── Properties/            # Launch settings
│   ├── appsettings.json       # OIDC configuration
│   └── Program.cs             # OIDC authentication setup
├── Frontend/                   # React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── contexts/         # React contexts
│   │   │   └── KeycloakContext.tsx  # OIDC auth context
│   │   ├── pages/            # Page components
│   │   │   ├── OidcSettings.tsx  # OIDC admin panel
│   │   │   ├── Dashboard.tsx
│   │   │   └── Settings.tsx
│   │   ├── lib/              # Utilities
│   │   ├── App.tsx           # Main app component
│   │   ├── main.tsx          # Entry point
│   │   └── keycloak.ts       # Keycloak OIDC client
│   ├── .env                  # OIDC environment config
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
└── docker-compose.yml         # Docker services
├── OIDC_AUTHENTICATION.md     # Complete OIDC documentation
├── KEYCLOAK_SETUP.md          # Step-by-step Keycloak setup
└── OIDC_QUICK_REFERENCE.md    # Quick reference guide
```

## Documentation

📚 **Comprehensive Guides**:

- **[OIDC Authentication](OIDC_AUTHENTICATION.md)** - Complete guide to OIDC implementation
- **[Keycloak Setup](KEYCLOAK_SETUP.md)** - Step-by-step Keycloak configuration
- **[Quick Reference](OIDC_QUICK_REFERENCE.md)** - Quick reference for common tasks

## API Endpoints

All endpoints require JWT authentication (Bearer token from OIDC):

### Users API
- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user
- `GET /api/users/me` - Get current authenticated user info

### OIDC Settings API
- `GET /api/oidcsettings/active` - Get active OIDC configuration
- `GET /api/oidcsettings` - Get all OIDC configurations
- `GET /api/oidcsettings/{id}` - Get specific configuration
- `POST /api/oidcsettings` - Create new OIDC configuration
- `PUT /api/oidcsettings/{id}` - Update OIDC configuration
- `PUT /api/oidcsettings/{id}/activate` - Set configuration as active
- `DELETE /api/oidcsettings/{id}` - Delete configuration
- `POST /api/oidcsettings/test` - Test OIDC provider connectivity

## Environment Variables

### Backend (appsettings.json)
```json
{
  "Oidc": {
    "Authority": "http://localhost:8080/realms/openradius",
    "ClientId": "openradius-api",
    "ClientSecret": "",
    "Audience": "openradius-api",
    "MetadataAddress": "http://localhost:8080/realms/openradius/.well-known/openid-configuration"
  }
}
```

### Frontend (.env)
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
VITE_API_URL=http://localhost:5000
```
- `VITE_API_URL` - Backend API URL

## Troubleshooting

### Keycloak connection issues
- Ensure Docker containers are running: `docker-compose ps`
- Check Keycloak logs: `docker logs openradius-keycloak`

### Backend database issues
- Verify PostgreSQL is running: `docker logs openradius-postgres`
- Run migrations: `dotnet ef database update`

### Frontend build errors
- Clear node_modules: `Remove-Item -Recurse -Force node_modules; npm install`
- Check .env file has correct values

## Stopping Services

```powershell
# Stop Docker services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

## Development Tips

- Backend hot reload is enabled by default
- Frontend has Vite HMR (Hot Module Replacement)
- Check browser console for Keycloak auth issues
- Use Swagger UI to test API endpoints directly
- Keycloak Admin Console for managing users/clients

## License

MIT
