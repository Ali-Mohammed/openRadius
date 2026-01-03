# Keycloak Admin Client Automation

This guide explains how to automatically create the `openradius-admin` service account client in Keycloak.

## Overview

The `openradius-admin` client is a service account used by the backend to manage Keycloak users via the Admin API. It uses client credentials grant type for authentication.

## Configuration

The client is already configured in [keycloak-config.json](../keycloak/keycloak-config.json):
- **Client ID**: `openradius-admin`
- **Client Secret**: `openradius-admin-secret-2026`
- **Service Accounts**: Enabled
- **Token Lifespan**: 3600 seconds

The backend configuration is in [appsettings.json](../Backend/appsettings.json):
```json
"KeycloakAdmin": {
  "BaseUrl": "http://localhost:8080",
  "Realm": "openradius",
  "ClientId": "openradius-admin",
  "ClientSecret": "openradius-admin-secret-2026"
}
```

## Automated Setup

### Option 1: PowerShell Script (Recommended)

Run the PowerShell script to create the client automatically:

```powershell
cd C:\Users\amohammed\Desktop\OpenRadius
.\scripts\create-admin-client.ps1
```

This script will:
1. ✅ Authenticate with Keycloak master realm
2. ✅ Check if the client already exists
3. ✅ Create the `openradius-admin` client
4. ✅ Enable service accounts
5. ✅ Assign user management roles (`manage-users`, `query-users`, `view-users`)

### Option 2: Manual PowerShell Commands

If you prefer to run commands manually:

```powershell
# 1. Get admin token
$keycloakUrl = "http://localhost:8080"
$realm = "openradius"
$tokenUrl = "$keycloakUrl/realms/master/protocol/openid-connect/token"
$tokenBody = @{
    grant_type = "password"
    client_id = "admin-cli"
    username = "admin"
    password = "admin"
}
$tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
$adminToken = $tokenResponse.access_token

# 2. Create the client
$clientConfig = '{"clientId":"openradius-admin","name":"OpenRadius Admin Client","enabled":true,"publicClient":false,"protocol":"openid-connect","standardFlowEnabled":false,"implicitFlowEnabled":false,"directAccessGrantsEnabled":false,"serviceAccountsEnabled":true,"secret":"openradius-admin-secret-2026","attributes":{"access.token.lifespan":"3600"}}'
$createClientUrl = "$keycloakUrl/admin/realms/$realm/clients"
$headers = @{
    Authorization = "Bearer $adminToken"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri $createClientUrl -Method Post -Headers $headers -Body $clientConfig

# 3. Get client UUID
$clientsUrl = "$keycloakUrl/admin/realms/$realm/clients?clientId=openradius-admin"
$client = (Invoke-RestMethod -Uri $clientsUrl -Method Get -Headers $headers)[0]
$clientUuid = $client.id

# 4. Get service account user
$serviceAccountUrl = "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/service-account-user"
$serviceUser = Invoke-RestMethod -Uri $serviceAccountUrl -Method Get -Headers $headers
$serviceUserId = $serviceUser.id

# 5. Get realm-management client
$realmMgmtUrl = "$keycloakUrl/admin/realms/$realm/clients?clientId=realm-management"
$realmMgmt = (Invoke-RestMethod -Uri $realmMgmtUrl -Method Get -Headers $headers)[0]
$realmMgmtId = $realmMgmt.id

# 6. Get roles
$rolesUrl = "$keycloakUrl/admin/realms/$realm/clients/$realmMgmtId/roles"
$allRoles = Invoke-RestMethod -Uri $rolesUrl -Method Get -Headers $headers
$manageUsersRole = $allRoles | Where-Object { $_.name -eq "manage-users" }
$queryUsersRole = $allRoles | Where-Object { $_.name -eq "query-users" }
$viewUsersRole = $allRoles | Where-Object { $_.name -eq "view-users" }

# 7. Assign roles
$rolesToAssign = @($manageUsersRole, $queryUsersRole, $viewUsersRole) | ConvertTo-Json
$assignRolesUrl = "$keycloakUrl/admin/realms/$realm/users/$serviceUserId/role-mappings/clients/$realmMgmtId"
Invoke-RestMethod -Uri $assignRolesUrl -Method Post -Headers $headers -Body $rolesToAssign
```

### Option 3: Keycloak Admin Console (Manual)

If automated methods fail, create the client manually:

1. Open http://localhost:8080/admin
2. Login with admin credentials (username: `admin`, password: `admin`)
3. Select `openradius` realm
4. Go to **Clients** → **Create client**
5. Fill in:
   - Client ID: `openradius-admin`
   - Click **Next**
6. Enable:
   - **Client authentication**: ON
   - **Service accounts roles**: ON
   - Click **Next**, then **Save**
7. Go to **Credentials** tab
8. Set Client Secret to: `openradius-admin-secret-2026`
9. Go to **Service account roles** tab
10. Assign the following roles from `realm-management` client:
    - `manage-users`
    - `query-users`
    - `view-users`

## Verification

Test if the client can authenticate:

```powershell
$testTokenUrl = "http://localhost:8080/realms/openradius/protocol/openid-connect/token"
$testBody = @{
    grant_type = "client_credentials"
    client_id = "openradius-admin"
    client_secret = "openradius-admin-secret-2026"
}
$testToken = Invoke-RestMethod -Uri $testTokenUrl -Method Post -Body $testBody -ContentType "application/x-www-form-urlencoded"

if ($testToken.access_token) {
    Write-Host "✅ SUCCESS: openradius-admin client authenticated!" -ForegroundColor Green
    Write-Host "Token type: $($testToken.token_type)" -ForegroundColor Cyan
    Write-Host "Expires in: $($testToken.expires_in) seconds" -ForegroundColor Cyan
} else {
    Write-Host "❌ ERROR: Authentication failed" -ForegroundColor Red
}
```

## Troubleshooting

### Issue: 401 Unauthorized

**Cause**: The `openradius-admin` client doesn't exist or has incorrect credentials.

**Solution**: Run the setup script or create the client manually.

### Issue: Insufficient Permissions

**Cause**: The service account doesn't have the required roles.

**Solution**: Assign `manage-users`, `query-users`, and `view-users` roles from the `realm-management` client.

### Issue: Import Skipped Message

**Cause**: Keycloak uses `IGNORE_EXISTING` strategy, which doesn't update existing realms.

**Solution**: Use the PowerShell script to create the client via API instead of relying on realm import.

## Next Steps

After creating the client:

1. Restart the backend application
2. Navigate to http://localhost:5173/users
3. Test user management features (create, edit, delete users)

## References

- Backend Configuration: [appsettings.json](../Backend/appsettings.json)
- Keycloak Configuration: [keycloak-config.json](../keycloak/keycloak-config.json)
- User Management Controller: [UserManagementController.cs](../Backend/Controllers/UserManagementController.cs)
- Frontend User Management: [UserManagement.tsx](../Frontend/src/pages/UserManagement.tsx)
