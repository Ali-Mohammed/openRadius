# OpenRadius Backend Setup

This guide provides additional backend-specific instructions.

## Database Migrations

Create a new migration:
```powershell
dotnet ef migrations add MigrationName
```

Apply migrations:
```powershell
dotnet ef database update
```

### Multi-Context Migrations

The application uses two database contexts:

**ApplicationDbContext** (Workspace databases):
```powershell
dotnet ef migrations add MigrationName --context ApplicationDbContext
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=5432;Database=openradius_workspace_1;Username=admin;Password=admin123"
dotnet ef database update --context ApplicationDbContext
```

**MasterDbContext** (Master database):
```powershell
dotnet ef migrations add MigrationName --context MasterDbContext
dotnet ef database update --context MasterDbContext
```

Remove last migration:
```powershell
dotnet ef migrations remove
```

## Soft Delete Pattern

The application implements a soft delete pattern across all entities:

### How It Works
- Items are **never permanently deleted** from the database
- Deletion sets `IsDeleted = true` and `DeletedAt = DateTime.UtcNow`
- All queries automatically filter out deleted items
- Deleted items can be viewed in "trash" views
- Items can be restored from trash

### Affected Entities
- **RadiusUser** (workspace databases)
- **RadiusProfile** (workspace databases)
- **SasRadiusIntegration** (workspace databases)
- **OidcSettings** (master database)

### API Endpoints

Each entity has three soft delete endpoints:

**Delete** (soft delete):
```
DELETE /api/{entity}/{id}
```

**Restore**:
```
POST /api/{entity}/{id}/restore
```

**Get Trash**:
```
GET /api/{entity}/trash
```

### Protection Rules
- Default OIDC provider **cannot be deleted**
- Soft deleted items are **excluded from all list queries** by default
- Deleted items maintain all relationships and data

## Testing with Swagger

1. Start the backend: `dotnet run`
2. Navigate to http://localhost:5000/swagger
3. To test protected endpoints:
   - First, get a token from Keycloak
   - Click "Authorize" button in Swagger UI
   - Enter: `Bearer YOUR_TOKEN_HERE`
   - Click "Authorize"

## Getting a Token Manually

Use curl or Postman:

```powershell
curl -X POST "http://localhost:8080/realms/openradius/protocol/openid-connect/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  -d "client_id=openradius-frontend" `
  -d "username=testuser" `
  -d "password=test123" `
  -d "grant_type=password"
```

## Environment Variables

Create a `.env` file in the Backend directory (optional):
```
ASPNETCORE_ENVIRONMENT=Development
```

## Running in Production

Update `appsettings.Production.json` with production values and set:
```powershell
$env:ASPNETCORE_ENVIRONMENT="Production"
dotnet run
```
