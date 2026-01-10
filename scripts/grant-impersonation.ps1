# Grant impersonation permission to a user in Keycloak
param(
    [Parameter(Mandatory=$false)]
    [string]$userEmail = "manager@example.com"
)

$keycloakUrl = "http://localhost:8080"
$realm = "openradius"
$adminUser = "admin"
$adminPassword = "admin123"

Write-Host "Granting impersonation permission to: $userEmail"

# Get admin token
$tokenUrl = "$keycloakUrl/realms/master/protocol/openid-connect/token"
$tokenBody = @{
    grant_type = "password"
    client_id = "admin-cli"
    username = $adminUser
    password = $adminPassword
}

$tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
$adminToken = $tokenResponse.access_token
Write-Host "Authenticated successfully"

$headers = @{
    Authorization = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

# Find user by email
Write-Host "Finding user: $userEmail"
$userSearchUrl = "$keycloakUrl/admin/realms/$realm/users?email=$([System.Uri]::EscapeDataString($userEmail))"
$users = Invoke-RestMethod -Uri $userSearchUrl -Method Get -Headers $headers

if ($users.Count -eq 0) {
    Write-Host "ERROR: User not found" -ForegroundColor Red
    exit 1
}

$user = $users[0]
$userId = $user.id
$userName = "$($user.firstName) $($user.lastName)"
Write-Host "Found user: $userName (ID: $userId)"

# Get realm-management client
Write-Host "Getting realm-management client..."
$realmManagementUrl = "$keycloakUrl/admin/realms/$realm/clients?clientId=realm-management"
$realmManagementClient = Invoke-RestMethod -Uri $realmManagementUrl -Method Get -Headers $headers
$realmManagementUuid = $realmManagementClient[0].id
Write-Host "Found realm-management client: $realmManagementUuid"

# Get impersonation role
Write-Host "Getting impersonation role..."
$rolesUrl = "$keycloakUrl/admin/realms/$realm/clients/$realmManagementUuid/roles"
$allRoles = Invoke-RestMethod -Uri $rolesUrl -Method Get -Headers $headers
$impersonationRole = $allRoles | Where-Object { $_.name -eq "impersonation" }

if (-not $impersonationRole) {
    Write-Host "ERROR: Impersonation role not found" -ForegroundColor Red
    exit 1
}

Write-Host "Found impersonation role"

# Assign impersonation role
Write-Host "Assigning impersonation role..."
$assignRoleUrl = "$keycloakUrl/admin/realms/$realm/users/$userId/role-mappings/clients/$realmManagementUuid"

$roleToAssign = @(
    @{
        id = $impersonationRole.id
        name = $impersonationRole.name
    }
)

$roleJson = ConvertTo-Json -InputObject $roleToAssign -Compress

try {
    Invoke-RestMethod -Uri $assignRoleUrl -Method Post -Headers $headers -Body $roleJson
    Write-Host "SUCCESS: Impersonation permission granted to $userName" -ForegroundColor Green
}
catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "INFO: User already has impersonation permission" -ForegroundColor Yellow
    }
    else {
        Write-Host "ERROR: Failed to assign role: $_" -ForegroundColor Red
        exit 1
    }
}

# Verify
Write-Host "Verifying assignment..."
$verifyUrl = "$keycloakUrl/admin/realms/$realm/users/$userId/role-mappings/clients/$realmManagementUuid"
$assignedRoles = Invoke-RestMethod -Uri $verifyUrl -Method Get -Headers $headers
$hasImpersonation = $assignedRoles | Where-Object { $_.name -eq "impersonation" }

if ($hasImpersonation) {
    Write-Host "VERIFIED: User can now impersonate other users" -ForegroundColor Green
    Write-Host "`nAssigned realm-management roles:"
    $assignedRoles | ForEach-Object { Write-Host "  - $($_.name)" }
}

Write-Host "`nDone!" -ForegroundColor Green
