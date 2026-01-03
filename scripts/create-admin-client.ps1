# Script to create openradius-admin client in Keycloak
# Run this script to automate the creation of the admin service account client

$keycloakUrl = "http://localhost:8080"
$realm = "openradius"
$adminUser = "admin"
$adminPassword = "admin"
$clientId = "openradius-admin"
$clientSecret = "openradius-admin-secret-2026"

Write-Host "🔑 Authenticating with Keycloak master realm..." -ForegroundColor Cyan

# Get admin token from master realm
$tokenUrl = "$keycloakUrl/realms/master/protocol/openid-connect/token"
$tokenBody = @{
    grant_type = "password"
    client_id = "admin-cli"
    username = $adminUser
    password = $adminPassword
}

try {
    $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    $adminToken = $tokenResponse.access_token
    Write-Host "✅ Successfully authenticated" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to authenticate: $_" -ForegroundColor Red
    exit 1
}

# Check if client already exists
Write-Host "`n🔍 Checking if client '$clientId' already exists..." -ForegroundColor Cyan
$clientsUrl = "$keycloakUrl/admin/realms/$realm/clients?clientId=$clientId"
$headers = @{
    Authorization = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

try {
    $existingClients = Invoke-RestMethod -Uri $clientsUrl -Method Get -Headers $headers
    
    if ($existingClients.Count -gt 0) {
        Write-Host "⚠️  Client '$clientId' already exists. Deleting and recreating..." -ForegroundColor Yellow
        $clientUuid = $existingClients[0].id
        $deleteUrl = "$keycloakUrl/admin/realms/$realm/clients/$clientUuid"
        Invoke-RestMethod -Uri $deleteUrl -Method Delete -Headers $headers
        Write-Host "✅ Deleted existing client" -ForegroundColor Green
    }
}
catch {
    Write-Host "ℹ️  Client does not exist yet" -ForegroundColor Gray
}

# Create the client
Write-Host "`n🔧 Creating '$clientId' client..." -ForegroundColor Cyan
$createClientUrl = "$keycloakUrl/admin/realms/$realm/clients"

$clientConfig = @{
    clientId = $clientId
    name = "OpenRadius Admin Client"
    description = "Service account for backend admin operations"
    enabled = $true
    publicClient = $false
    protocol = "openid-connect"
    standardFlowEnabled = $false
    implicitFlowEnabled = $false
    directAccessGrantsEnabled = $false
    serviceAccountsEnabled = $true
    authorizationServicesEnabled = $false
    secret = $clientSecret
    attributes = @{
        "access.token.lifespan" = "3600"
    }
    defaultClientScopes = @(
        "web-origins",
        "acr",
        "profile",
        "roles",
        "email"
    )
    optionalClientScopes = @(
        "address",
        "phone",
        "offline_access",
        "microprofile-jwt"
    )
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri $createClientUrl -Method Post -Headers $headers -Body $clientConfig
    Write-Host "✅ Successfully created client '$clientId'" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to create client: $_" -ForegroundColor Red
    exit 1
}

# Get the created client to retrieve its UUID
Write-Host "`n🔍 Retrieving client details..." -ForegroundColor Cyan
$existingClients = Invoke-RestMethod -Uri $clientsUrl -Method Get -Headers $headers
$clientUuid = $existingClients[0].id

# Get the service account user
Write-Host "`n👤 Getting service account user..." -ForegroundColor Cyan
$serviceAccountUrl = "$keycloakUrl/admin/realms/$realm/clients/$clientUuid/service-account-user"
try {
    $serviceAccountUser = Invoke-RestMethod -Uri $serviceAccountUrl -Method Get -Headers $headers
    Write-Host "✅ Service account user ID: $($serviceAccountUser.id)" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Could not retrieve service account user: $_" -ForegroundColor Yellow
}

# Assign admin roles to service account
Write-Host "`n🔐 Assigning admin roles to service account..." -ForegroundColor Cyan
$realmManagementUrl = "$keycloakUrl/admin/realms/$realm/clients?clientId=realm-management"
try {
    $realmManagementClient = Invoke-RestMethod -Uri $realmManagementUrl -Method Get -Headers $headers
    $realmManagementUuid = $realmManagementClient[0].id
    
    # Get available roles
    $rolesUrl = "$keycloakUrl/admin/realms/$realm/clients/$realmManagementUuid/roles"
    $allRoles = Invoke-RestMethod -Uri $rolesUrl -Method Get -Headers $headers
    
    # Find manage-users role
    $manageUsersRole = $allRoles | Where-Object { $_.name -eq "manage-users" }
    $queryUsersRole = $allRoles | Where-Object { $_.name -eq "query-users" }
    $viewUsersRole = $allRoles | Where-Object { $_.name -eq "view-users" }
    
    if ($manageUsersRole -and $serviceAccountUser) {
        $assignRolesUrl = "$keycloakUrl/admin/realms/$realm/users/$($serviceAccountUser.id)/role-mappings/clients/$realmManagementUuid"
        $rolesToAssign = @()
        
        if ($manageUsersRole) { $rolesToAssign += $manageUsersRole }
        if ($queryUsersRole) { $rolesToAssign += $queryUsersRole }
        if ($viewUsersRole) { $rolesToAssign += $viewUsersRole }
        
        $rolesJson = $rolesToAssign | ConvertTo-Json -Depth 10
        
        Invoke-RestMethod -Uri $assignRolesUrl -Method Post -Headers $headers -Body $rolesJson
        Write-Host "✅ Assigned user management roles to service account" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️  Could not assign admin roles: $_" -ForegroundColor Yellow
}

Write-Host "`n✨ Setup Complete! ✨" -ForegroundColor Green
Write-Host "`nClient Configuration:" -ForegroundColor Cyan
Write-Host "  Client ID: $clientId" -ForegroundColor White
Write-Host "  Client Secret: $clientSecret" -ForegroundColor White
Write-Host "  Service Accounts: Enabled" -ForegroundColor White
Write-Host "`nThis client is now ready to be used by the backend!" -ForegroundColor Green
Write-Host "`nYou can now restart your backend application." -ForegroundColor Yellow
