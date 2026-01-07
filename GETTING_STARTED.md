# Getting Started with OpenRadius

This guide will walk you through setting up and running the OpenRadius application from scratch, including database migrations, seed data, and both frontend and backend services.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker & Docker Compose** (for PostgreSQL and Keycloak)
- **.NET 8.0 SDK** (for the backend)
- **Node.js 18+** (for the frontend)
- **pnpm** (package manager)

Verify installations:
```bash
docker --version
docker-compose --version
dotnet --version
node --version
pnpm --version
```

## Project Structure

```
openRadius/
├── Backend/           # .NET 8.0 Web API
├── Frontend/          # React + TypeScript + Vite
├── keycloak/          # Keycloak configuration
├── docker-compose.yml # PostgreSQL + Keycloak services
└── init-db.sh        # Database initialization script
```

## Step 1: Start Infrastructure Services

The application requires PostgreSQL and Keycloak running via Docker.

### 1.1 Start Docker Services

```bash
# From the project root
docker-compose up -d
```

This will start:
- **PostgreSQL** on port `5432`
- **Keycloak** on port `8080`

### 1.2 Verify Services Are Running

```bash
# Check container status
docker-compose ps

# Should show:
# openradius-postgres   running   0.0.0.0:5432->5432/tcp
# openradius-keycloak   running   0.0.0.0:8080->8080/tcp
```

### 1.3 Wait for Services to Be Ready

```bash
# Check PostgreSQL
docker-compose logs postgres | grep "database system is ready"

# Check Keycloak (may take 1-2 minutes)
docker-compose logs keycloak | grep "Running the server in development mode"
```

## Step 2: Configure Keycloak

### 2.1 Access Keycloak Admin Console

1. Open browser: http://localhost:8080
2. Login with credentials:
   - Username: `admin`
   - Password: `admin`

### 2.2 Import Realm Configuration

```bash
# Import the OpenRadius realm
docker-compose exec keycloak /opt/keycloak/bin/kc.sh import \
  --file /opt/keycloak/data/import/keycloak-config.json \
  --override true
```

Or manually:
1. Go to Keycloak Admin Console
2. Click on realm dropdown (top-left)
3. Click "Create Realm"
4. Click "Browse" and select `keycloak/keycloak-config.json`
5. Click "Create"

### 2.3 Verify Realm Configuration

1. Switch to the `openradius` realm
2. Navigate to **Clients**
3. Verify these clients exist:
   - `openradius-web` (Public client for frontend)
   - `openradius-admin` (Service account for backend)
   - `openradius-api` (Bearer-only for token validation)

### 2.4 Create Admin User

1. Go to **Users** in the `openradius` realm
2. Click **Add user**
3. Fill in details:
   - Username: `admin@openradius.local`
   - Email: `admin@openradius.local`
   - First Name: `Admin`
   - Last Name: `User`
   - Email Verified: `ON`
4. Click **Create**
5. Go to **Credentials** tab
6. Click **Set password**
7. Enter password: `admin123`
8. Turn OFF "Temporary"
9. Click **Save**

## Step 3: Setup Backend (.NET)

### 3.1 Navigate to Backend Directory

```bash
cd Backend
```

### 3.2 Restore Dependencies

```bash
dotnet restore
```

### 3.3 Configure Connection String

The `appsettings.json` already has the correct configuration for local development:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=openradius;Username=admin;Password=admin123"
  },
  "Oidc": {
    "Authority": "http://localhost:8080/realms/openradius",
    "ClientId": "openradius-web",
    ...
  }
}
```

### 3.4 Run Database Migrations

The application uses a **dual database architecture**:

1. **Master Database (`openradius`)**: Stores global data
   - Workspaces (tenants)
   - Users, Roles, Permissions, Groups
   - OIDC settings
   - Debezium connectors
   - Uses: `MasterDbContext`

2. **Workspace Databases (`openradius_workspace_X`)**: One per tenant/workspace
   - RADIUS users, groups, profiles
   - RADIUS NAS devices
   - IP pools, tags
   - SAS integrations
   - Uses: `ApplicationDbContext`

The application will automatically:
- Create the `openradius` master database
- Run **MasterDbContext** migrations
- Seed initial data (roles, permissions, groups, OIDC settings)
- Create default workspace database(s)
- Run **ApplicationDbContext** migrations for each workspace

This happens on the first run when you start the backend.

### 3.5 Start the Backend

```bash
dotnet run
```

Expected output:
```
=== Checking seed data status ===
Current counts - Permissions: 0, Roles: 0, Groups: 0, RolePermissions: 0
Seeding Permissions...
✓ 50 Permissions seeded
Seeding Roles...
✓ 5 Roles seeded
Seeding Groups...
✓ 3 Groups seeded
Seeding Role-Permission mappings...
✓ 75 Role-Permission mappings seeded
✓ Default Keycloak OIDC provider seeded
=== Seed data check complete ===

info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5000
```

**Backend is now running on:** http://localhost:5000

Keep this terminal open. The backend needs to stay running.

## Step 4: Setup Frontend (React)

Open a **new terminal** for the frontend.

### 4.1 Navigate to Frontend Directory

```bash
cd Frontend
```

### 4.2 Install Dependencies

```bash
pnpm install
```

### 4.3 Configure Environment Variables

Create or verify `.env` file:

```bash
# Check if .env exists
cat .env

# If not, copy from example
cp .env.example .env
```

The `.env` should contain:
```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=openradius
VITE_KEYCLOAK_CLIENT_ID=openradius-web
VITE_API_URL=http://localhost:5000
```

### 4.4 Start the Frontend

```bash
pnpm dev
```

Expected output:
```
VITE v7.3.0  ready in 279 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

**Frontend is now running on:** http://localhost:5173

## Step 5: Access the Application

### 5.1 Open the Application

Navigate to: **http://localhost:5173**

### 5.2 Login

1. You'll be redirected to the Keycloak login page
2. Enter credentials:
   - Username: `admin@openradius.local`
   - Password: `admin123`
3. Click **Sign In**

### 5.3 Verify Login

After successful login, you should:
- Be redirected to the OpenRadius dashboard
- See the main navigation menu
- See your username in the top-right corner

## Quick Start Commands

For subsequent runs, use these commands:

### Terminal 1: Start Infrastructure
```bash
# From project root
docker-compose up -d
```

### Terminal 2: Start Backend
```bash
cd Backend
dotnet run
```

### Terminal 3: Start Frontend
```bash
cd Frontend
pnpm dev
```

## Stopping the Application

### Stop Frontend
Press `Ctrl+C` in the frontend terminal

### Stop Backend
Press `Ctrl+C` in the backend terminal

### Stop Docker Services
```bash
# From project root
docker-compose down
```

To also remove volumes (database data):
```bash
docker-compose down -v
```

## Database Management

### View Database Contents

#### Using psql

**View Master Database:**
```bash
# Connect to master database
docker-compose exec postgres psql -U admin -d openradius

# List tables
\dt

# View OIDC settings
SELECT "Id", "ProviderName", "ClientId", "IsActive" FROM "OidcSettings";

# View workspaces
SELECT "Id", "Name", "Title", "Status" FROM "Workspaces";

# Exit
\q
```

**View Workspace Database:**
```bash
# Connect to workspace database (default workspace has ID 1)
docker-compose exec postgres psql -U admin -d openradius_workspace_1

# List tables
\dt

# View RADIUS users
SELECT "Id", "Username", "Email" FROM "RadiusUsers" LIMIT 10;

# Exit
\q
```

#### Using Prisma Studio (if installed)
```bash
cd Backend
npx prisma studio
```

### Reset Database

If you need to start fresh:

```bash
# Stop services
docker-compose down -v

# Start services (will recreate database)
docker-compose up -d

# Wait for services to be ready, then restart backend
cd Backend
dotnet run
```

The backend will automatically recreate and seed the database on startup.

## Troubleshooting

### Issue: "Bearer-only applications are not allowed to initiate browser login"

**Solution:** The OIDC settings in the database have the wrong client ID.

```bash
# Fix via database
docker-compose exec postgres psql -U admin -d openradius -c \
  "UPDATE \"OidcSettings\" SET \"ClientId\" = 'openradius-web' WHERE \"ProviderName\" = 'keycloak';"
```

Then refresh the browser and clear session storage (F12 → Application → Session Storage → Clear).

### Issue: Backend can't connect to database

**Verify:**
1. PostgreSQL is running: `docker-compose ps`
2. Connection string in `appsettings.json` is correct
3. Database credentials match do both contexts:
```bash
cd Backend

# Remove migration folders
rm -rf Migrations/MasterDb/*
rm -rf Migrations/WorkspaceDb/*

# Create new migrations for BOTH contexts
dotnet ef migrations add InitialCreate --context MasterDbContext --output-dir Migrations/MasterDb
dotnet ef migrations add InitialCreate --context ApplicationDbContext --output-dir Migrations/WorkspaceDb

# Run application (will apply both migrations)
dotnet run
```

**Note:** Both migrations must exist for the application to start successfully.Client `openradius-web` exists and is enabled
4. User exists in the realm
5. Clear browser cache and session storage

### Issue: Migrations not running

Delete migrations and regenerate:
```bash
cd Backend

# Remove migration folders
rm -rf Migrations/MasterDb/*
rm -rf Migrations/WorkspaceDb/*

# Create new migrations
dotnet ef migrations add InitialCreate --context MasterDbContext --output-dir Migrations/MasterDb
dotnet ef migrations add InitialCreate --context ApplicationDbContext --output-dir Migrations/WorkspaceDb

# Run application (will apply migrations)
dotnet run
```

## Development Workflow

### Making Backend Changes

1. Make your code changes
2. Backend will auto-reload (if using `dotnet watch run`)
3. Test changes via API or frontend

### Making Frontend Changes

1. Make your code changes
2. Vite will hot-reload automatically
3. View changes in browser immediately

### Database Schema Changes

The application has two separate database contexts that require separate migrations:

#### For Master Database Changes (Users, Roles, Workspaces, OIDC)
```bash
cd Backend
dotnet ef migrations add YourMigrationName --context MasterDbContext --output-dir Migrations/MasterDb
```

#### For Workspace Database Changes (RADIUS entities)
```bash
cd Backend
dotnet ef migrations add YourMigrationName --context ApplicationDbContext --output-dir Migrations/WorkspaceDb
```

#### Apply Migrations
Restart backend to automatically apply both migrations:
```bash
dotnet run
```

## Useful URLs

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **Swagger/API Docs:** http://localhost:5000/swagger
- **Keycloak Admin:** http://localhost:8080
- **PostgreSQL:** localhost:5432

## Next Steps

- Read [ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md) to understand the system
- Review [OIDC_AUTHENTICATION.md](docs/OIDC_AUTHENTICATION.md) for authentication details
- Check [MULTI_TENANT_IMPLEMENTATION.md](docs/MULTI_TENANT_IMPLEMENTATION.md) for multi-tenancy info
- See [Frontend-README.md](docs/Frontend-README.md) for frontend development guide
- See [Backend-README.md](docs/Backend-README.md) for backend development guide

## Support

For issues or questions:
1. Check existing documentation in the `docs/` folder
2. Review error messages in terminal outputs
3. Check Docker logs: `docker-compose logs [service-name]`

---

**Happy coding! 🚀**
