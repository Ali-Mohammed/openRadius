# Multi-Tenant Implementation with Finbuckle.MultiTenant

## Overview
This implementation adds multi-tenant capabilities to OpenRadius using Finbuckle.MultiTenant. Each Instant (tenant) gets its own isolated PostgreSQL database, and users can switch between different Instants/tenants.

## Architecture

### Database Per Tenant Strategy
- **Master Database**: Stores all Instants, Users, and OIDC settings
- **Tenant Databases**: Each Instant gets its own database named `openradius_instant_{id}`

### Key Components

#### 1. Models
- **InstantTenantInfo.cs**: Custom tenant information class (needs Finbuckle v10 compatibility fixes)
- **User.cs**: Enhanced with `DefaultInstantId` and `CurrentInstantId` for tenant selection

#### 2. Data Contexts
- **MasterDbContext**: Manages the master database with all tenants, users, and OIDC settings
- **ApplicationDbContext**: Tenant-specific context that connects to individual tenant databases

#### 3. Services
- **InstantTenantStore.cs**: Loads tenant information from the master database based on Instant records
- **UserInstantTenantResolver.cs**: Resolves current tenant from:
  1. X-Tenant-Id header (for explicit switching)
  2. User's CurrentInstantId from JWT claims
  3. User's DefaultInstantId as fallback

#### 4. Controllers
- **TenantController.cs**: Manages tenant switching and preferences
  - `GET /api/tenant/available` - List available tenants for user
  - `GET /api/tenant/current` - Get current tenant preferences
  - `POST /api/tenant/switch` - Switch to a different tenant
  - `POST /api/tenant/set-default` - Set default tenant
  
- **InstantController.cs**: Enhanced to create tenant databases when new Instants are created

## Usage Flow

### 1. Creating an Instant
When a new Instant is created via `POST /api/instant`:
1. Instant record is saved to master database
2. A new PostgreSQL database is automatically created: `openradius_instant_{id}`
3. EF Core migrations are applied to the new tenant database

### 2. User Tenant Selection
Users can select their active tenant in two ways:

**Set Default Tenant:**
```http
POST /api/tenant/set-default
Content-Type: application/json

{
  "instantId": 1
}
```

**Switch Current Tenant:**
```http
POST /api/tenant/switch
Content-Type: application/json

{
  "instantId": 2
}
```

### 3. Tenant Resolution
The system resolves the current tenant in this order:
1. `X-Tenant-Id` header (for explicit tenant switching)
2. User's `CurrentInstantId` from database
3. User's `DefaultInstantId` as fallback

### 4. Making Tenant-Scoped Requests
Frontend should include the tenant ID header after switching:
```http
GET /api/someresource
Authorization: Bearer {jwt_token}
X-Tenant-Id: 2
```

## Known Issues & TODOs

### Compilation Errors to Fix

#### 1. TenantInfo Constructor Issue
Finbuckle.MultiTenant v10.0 uses a different TenantInfo structure. Need to:
- Check Finbuckle.MultiTenant.Abstractions.TenantInfo constructor signature
- Update InstantTenantInfo to properly inherit/implement
- Alternative: Use built-in TenantInfo with extension properties

#### 2. AddMultiTenant Extension Method
The `AddMultiTenant` extension method signature has changed in v10. Need to:
- Import correct namespace (likely `Finbuckle.MultiTenant.AspNetCore`)
- Use proper configuration API for v10

#### 3. UseMultiTenant Middleware
The middleware registration may have changed. Check v10 documentation for proper usage.

### Recommended Fixes

**Option 1: Use Dictionary for Custom Properties**
```csharp
// Instead of custom InstantTenantInfo, use TenantInfo with properties dictionary
var tenantInfo = new TenantInfo
{
    Id = instant.Id.ToString(),
    Identifier = instant.Name,
    Name = instant.Title
};
// Store custom data in properties dictionary if available in v10
```

**Option 2: Downgrade to Finbuckle v8/v9**
```bash
dotnet remove package Finbuckle.MultiTenant.AspNetCore
dotnet remove package Finbuckle.MultiTenant.EntityFrameworkCore
dotnet add package Finbuckle.MultiTenant --version 8.0.4
dotnet add package Finbuckle.MultiTenant.EntityFrameworkCore --version 8.0.4
```

**Option 3: Check Finbuckle v10 Documentation**
Review official docs: https://www.finbuckle.com/MultiTenant/Docs/v10.0/Introduction

## Migration Steps

Once compilation issues are resolved:

1. **Create Migration for Master Database:**
   ```bash
   dotnet ef migrations add AddMultiTenantSupport --context MasterDbContext
   dotnet ef database update --context MasterDbContext
   ```

2. **Update Connection String in appsettings.json:**
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Database=openradius_master;Username=postgres;Password=your_password"
     }
   }
   ```

3. **Test Tenant Creation:**
   - Create a new Instant via API
   - Verify tenant database is created
   - Check migrations are applied

4. **Test Tenant Switching:**
   - Login as a user
   - Set default tenant
   - Switch between tenants
   - Verify X-Tenant-Id header is respected

## Frontend Integration

### Store Current Tenant
```typescript
// Store after switching
const response = await fetch('/api/tenant/switch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ instantId: selectedInstantId })
});

const data = await response.json();
localStorage.setItem('currentTenantId', data.tenantId);
```

### Include in Requests
```typescript
// Add to all API requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'X-Tenant-Id': localStorage.getItem('currentTenantId')
};
```

### Tenant Selector Component
Create a dropdown/selector component that:
1. Fetches available tenants from `/api/tenant/available`
2. Shows current tenant from `/api/tenant/current`
3. Calls `/api/tenant/switch` when user selects different tenant
4. Updates local storage and triggers app-wide tenant change event

## Security Considerations

1. **Authorization**: Implement checks to ensure users can only access tenants they're authorized for
2. **Tenant Isolation**: All queries automatically scope to tenant database
3. **User-Tenant Mapping**: Consider adding a UserTenant join table for explicit permissions
4. **Audit Trail**: Log all tenant switches for security auditing

## Performance Optimization

1. **Connection Pooling**: Configure per-tenant connection pools
2. **Tenant Caching**: Cache tenant info to avoid repeated DB lookups
3. **Lazy Database Creation**: Only create tenant DB when first accessed (currently creates on Instant creation)

## Files Created/Modified

### Created:
- `Backend/Models/InstantTenantInfo.cs`
- `Backend/Data/MasterDbContext.cs`
- `Backend/Services/InstantTenantStore.cs`
- `Backend/Services/UserInstantTenantResolver.cs`
- `Backend/Controllers/TenantController.cs`

### Modified:
- `Backend/Models/User.cs` - Added DefaultInstantId, CurrentInstantId
- `Backend/Data/ApplicationDbContext.cs` - Multi-tenant support
- `Backend/Controllers/InstantController.cs` - Auto-create tenant databases
- `Backend/Program.cs` - Multi-tenant configuration
- `Backend/Backend.csproj` - Added Finbuckle packages
