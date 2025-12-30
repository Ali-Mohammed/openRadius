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

Remove last migration:
```powershell
dotnet ef migrations remove
```

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
