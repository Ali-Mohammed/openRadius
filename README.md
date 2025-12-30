# OpenRadius

Full-stack application with ASP.NET Core 10 backend, React 19 frontend with Vite, Tailwind CSS, shadcn/ui, Keycloak authentication, PostgreSQL database, and Docker.

## Tech Stack

### Backend
- ASP.NET Core 10 Web API
- Entity Framework Core
- PostgreSQL
- Keycloak JWT Authentication

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Keycloak JS client
- React Router v7
- Axios

### Infrastructure
- Docker & Docker Compose
- PostgreSQL 16
- Keycloak 23.0

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting Started

### 1. Start Docker Services

Start PostgreSQL and Keycloak:

```powershell
docker-compose up -d
```

Wait for services to be ready (about 30-60 seconds). Check status:

```powershell
docker-compose ps
```

### 2. Configure Keycloak

1. Open Keycloak Admin Console: http://localhost:8080
2. Login with:
   - Username: `admin`
   - Password: `admin`

3. Create a new realm:
   - Click "Create Realm"
   - Name: `openradius`
   - Click "Create"

4. Create a client for the backend API:
   - Go to "Clients" → "Create client"
   - Client ID: `openradius-api`
   - Click "Next"
   - Enable "Client authentication"
   - Click "Save"

5. Create a client for the frontend:
   - Go to "Clients" → "Create client"
   - Client ID: `openradius-frontend`
   - Click "Next"
   - Enable "Standard flow"
   - Click "Save"
   - In Settings tab, add Valid redirect URIs: `http://localhost:5173/*`
   - Add Web origins: `http://localhost:5173`
   - Click "Save"

6. Create a test user:
   - Go to "Users" → "Create new user"
   - Username: `testuser`
   - Email: `test@example.com`
   - Click "Create"
   - Go to "Credentials" tab
   - Click "Set password"
   - Password: `test123` (disable temporary)
   - Click "Save"

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

## Usage

1. Navigate to http://localhost:5173
2. Click "Sign In" button
3. Login with Keycloak credentials (testuser / test123)
4. You'll be redirected to the Dashboard

The Dashboard displays:
- Your user information from Keycloak token
- List of users from the PostgreSQL database (via backend API)

## Project Structure

```
OpenRadius/
├── Backend/                    # ASP.NET Core API
│   ├── Controllers/           # API Controllers
│   ├── Data/                  # DbContext
│   ├── Models/                # Domain models
│   ├── Properties/            # Launch settings
│   ├── appsettings.json       # Configuration
│   └── Program.cs             # Application entry
├── Frontend/                   # React application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── contexts/         # React contexts (Keycloak)
│   │   ├── lib/              # Utilities
│   │   ├── pages/            # Page components
│   │   ├── App.tsx           # Main app component
│   │   ├── main.tsx          # Entry point
│   │   └── keycloak.ts       # Keycloak configuration
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
└── docker-compose.yml         # Docker services

```

## API Endpoints

All endpoints require JWT authentication (except Swagger):

- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user
- `GET /api/users/me` - Get current authenticated user info

## Environment Variables

### Backend (appsettings.json)
- `ConnectionStrings:DefaultConnection` - PostgreSQL connection string
- `Keycloak:Authority` - Keycloak realm URL
- `Keycloak:Audience` - API client ID

### Frontend (.env)
- `VITE_KEYCLOAK_URL` - Keycloak server URL
- `VITE_KEYCLOAK_REALM` - Keycloak realm name
- `VITE_KEYCLOAK_CLIENT_ID` - Frontend client ID
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
