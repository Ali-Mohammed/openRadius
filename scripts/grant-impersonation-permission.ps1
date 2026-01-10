# Script to grant impersonation permission to a user in Keycloak
# Usage: .\grant-impersonation-permission.ps1 -userEmail "manager@example.com"

param(
    [Parameter(Mandatory=$false)]
    [string]$userEmail = "manager@example.com"
)

$keycloakUrl = "http://localhost:8080"
$realm = "openradius"
$adminUser = "admin"
$adminPassword = "admin"

Write-Host "🔑 Granting impersonation permission to: $userEmail" -ForegroundColor Cyan

# Get admin token from master realm
Write-Host "`n🔐 Authenticating with Keycloak..." -ForegroundColor Cyan
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
    Write-Host "✅ Authenticated successfully" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to authenticate: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    Authorization = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

# Find user by email
Write-Host "`n🔍 Finding user with email: $userEmail..." -ForegroundColor Cyan
$userSearchUrl = "$keycloakUrl/admin/realms/$realm/users?email=$([System.Uri]::EscapeDataString($userEmail))"

try {
    $users = Invoke-RestMethod -Uri $userSearchUrl -Method Get -Headers $headers
    
    if ($users.Count -eq 0) {
        Write-Host "❌ User not found with email: $userEmail" -ForegroundColor Red
        exit 1
    }
    
    $user = $users[0]
    $userId = $user.id
    $userName = "$($user.firstName) $($user.lastName)"
    Write-Host "✅ Found user: $userName (ID: $userId)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to find user: $_" -ForegroundColor Red
    exit 1
}

# Get realm-management client
Write-Host "`n🔍 Getting realm-management client..." -ForegroundColor Cyan
$realmManagementUrl = "$keycloakUrl/admin/realms/$realm/clients?clientId=realm-management"

try {
    $realmManagementClient = Invoke-RestMethod -Uri $realmManagementUrl -Method Get -Headers $headers
    
    if ($realmManagementClient.Count -eq 0) {
        Write-Host "❌ realm-management client not found" -ForegroundColor Red
        exit 1
    }
    
    $realmManagementUuid = $realmManagementClient[0].id
    Write-Host "✅ Found realm-management client (ID: $realmManagementUuid)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to get realm-management client: $_" -ForegroundColor Red
    exit 1
}

# Get all available roles from realm-management client
Write-Host "`n🔍 Getting available roles..." -ForegroundColor Cyan
$rolesUrl = "$keycloakUrl/admin/realms/$realm/clients/$realmManagementUuid/roles"

try {
    $allRoles = Invoke-RestMethod -Uri $rolesUrl -Method Get -Headers $headers
    
    # Find the impersonation role
    $impersonationRole = $allRoles | Where-Object { $_.name -eq "impersonation" }
    
    if (-not $impersonationRole) {
        Write-Host "❌ Impersonation role not found in realm-management client" -ForegroundColor Red
        Write-Host "Available roles:" -ForegroundColor Yellow
        $allRoles | ForEach-Object { Write-Host "  • $($_.name)" -ForegroundColor Gray }
        exit 1
    }
    
    Write-Host "✅ Found impersonation role" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to get roles: $_" -ForegroundColor Red
    exit 1
}

# Assign impersonation role to user
Write-Host "`n🔐 Assigning impersonation role to user..." -ForegroundColor Cyan
$assignRoleUrl = "$keycloakUrl/admin/realms/$realm/users/$userId/role-mappings/clients/$realmManagementUuid"

$roleToAssign = @(
    @{
        id = $impersonationRole.id
        name = $impersonationRole.name
        containerId = $realmManagementUuid
    }
)

$roleJson = $roleToAssign | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Uri $assignRoleUrl -Method Post -Headers $headers -Body $roleJson
    Write-Host "Successfully assigned impersonation permission!" -ForegroundColor Green
    Write-Host "`nUser '$userName' can now impersonate other users" -ForegroundColor Green
}
catch {
    # Check if role is already assigned
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "Impersonation role already assigned to this user" -ForegroundColor Yellow
    }
    else {
        Write-Host "Failed to assign role: $_" -ForegroundColor Red
        exit 1
    }
}

# Verify the assignment
Write-Host "`n🔍 Verifying role assignment..." -ForegroundColor Cyan
$verifyUrl = "$keycloakUrl/admin/realms/$realm/users/$userId/role-mappings/clients/$realmManagementUuid"

try {
    $assignedRoles = Invoke-RestMethod -Uri $verifyUrl -Method Get -Headers $headers
    $hasImpersonation = $assignedRoles | Where-Object { $_.name -eq "impersonation" }
    
    if ($hasImpersonation) {
        Write-Host "✅ Verification successful - impersonation role is assigned" -ForegroundColor Green
        Write-Host "`nAssigned realm-management roles for this user:" -ForegroundColor Cyan
        $assignedRoles | ForEach-Object { Write-Host "  • $($_.name)" -ForegroundColor Gray }
    }
    else {
        Write-Host "⚠️  Warning: Could not verify role assignment" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️  Could not verify role assignment: $_" -ForegroundColor Yellow
}

Write-Host "`n✅ Done! User can now use the impersonation feature." -ForegroundColor Green
