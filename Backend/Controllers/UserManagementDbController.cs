using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/user-management")]
[Authorize]
public class UserManagementDbController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ApplicationDbContext _appContext;
    private readonly ILogger<UserManagementDbController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public UserManagementDbController(
        MasterDbContext context,
        ApplicationDbContext appContext,
        ILogger<UserManagementDbController> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _appContext = appContext;
        _logger = logger;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    // POST: api/user-management/sync-keycloak-users
    [HttpPost("sync-keycloak-users")]
    public async Task<IActionResult> SyncKeycloakUsers()
    {
        try
        {
            _logger.LogInformation("Starting Keycloak user sync...");
            
            var client = await GetAuthenticatedKeycloakClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                _logger.LogError("Oidc:Authority configuration is missing");
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users?max=1000";
            
            _logger.LogInformation("Fetching users from Keycloak: {Url}", url);

            var response = await client.GetAsync(url);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Keycloak API returned error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                return StatusCode((int)response.StatusCode, new { error = "Keycloak API error", details = errorContent });
            }
            
            response.EnsureSuccessStatusCode();

            var keycloakUsers = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            
            if (keycloakUsers == null)
            {
                _logger.LogWarning("No users found in Keycloak response");
                return Ok(new { message = "No users found in Keycloak", syncedCount = 0 });
            }

            _logger.LogInformation("Found {Count} users in Keycloak", keycloakUsers.Count);
            
            int syncedCount = 0;
            int updatedCount = 0;

            foreach (var kUser in keycloakUsers)
            {
                var keycloakUserId = kUser.TryGetProperty("id", out var id) ? id.GetString() : null;
                if (string.IsNullOrEmpty(keycloakUserId)) continue;

                var email = kUser.TryGetProperty("email", out var e) ? e.GetString() : null;
                var firstName = kUser.TryGetProperty("firstName", out var fn) ? fn.GetString() : null;
                var lastName = kUser.TryGetProperty("lastName", out var ln) ? ln.GetString() : null;
                var username = kUser.TryGetProperty("username", out var un) ? un.GetString() : null;

                var finalEmail = email ?? username ?? $"user-{keycloakUserId}";

                // Check if user already exists (by KeycloakUserId or Email)
                var existingUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.KeycloakUserId == keycloakUserId || u.Email == finalEmail);

                if (existingUser == null)
                {
                    // Create new user
                    var newUser = new User
                    {
                        KeycloakUserId = keycloakUserId,
                        Email = finalEmail,
                        Username = username,
                        FirstName = firstName ?? string.Empty,
                        LastName = lastName ?? string.Empty,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Users.Add(newUser);
                    syncedCount++;
                    _logger.LogInformation("Adding new user: {Email}, Username: {Username}", finalEmail, username);
                }
                else
                {
                    // Update existing user
                    var keycloakIdChanged = existingUser.KeycloakUserId != keycloakUserId;
                    if (string.IsNullOrEmpty(existingUser.KeycloakUserId) || keycloakIdChanged)
                    {
                        if (keycloakIdChanged)
                        {
                            _logger.LogWarning("⚠️ Correcting KeycloakUserId mismatch for {Email}: {OldId} → {NewId}", 
                                finalEmail, existingUser.KeycloakUserId ?? "NULL", keycloakUserId);
                        }
                        existingUser.KeycloakUserId = keycloakUserId;
                    }
                    existingUser.Email = finalEmail;
                    existingUser.Username = username;
                    existingUser.FirstName = firstName ?? string.Empty;
                    existingUser.LastName = lastName ?? string.Empty;
                    updatedCount++;
                    _logger.LogInformation("Updating existing user: {Email}, Username: {Username}", finalEmail, username);
                }
            }

            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Sync completed: {Synced} new, {Updated} updated", syncedCount, updatedCount);

            return Ok(new 
            { 
                message = "Keycloak users synced successfully",
                syncedCount = syncedCount,
                updatedCount = updatedCount,
                totalProcessed = keycloakUsers.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing Keycloak users: {Message}", ex.Message);
            return StatusCode(500, new { error = "Failed to sync Keycloak users", message = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    private async Task<HttpClient> GetAuthenticatedKeycloakClient()
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                throw new InvalidOperationException("Oidc:Authority configuration is missing");
            }
            
            var realm = authority.Split("/").Last();
            var tokenUrl = $"{authority.Replace($"/realms/{realm}", "")}/realms/{realm}/protocol/openid-connect/token";
            
            var clientId = _configuration["KeycloakAdmin:ClientId"] ?? "openradius-admin";
            var clientSecret = _configuration["KeycloakAdmin:ClientSecret"] ?? "";
            
            _logger.LogInformation("Authenticating with Keycloak using client: {ClientId}", clientId);

            var tokenRequest = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "client_credentials"),
                new KeyValuePair<string, string>("client_id", clientId),
                new KeyValuePair<string, string>("client_secret", clientSecret)
            });

            var tokenResponse = await client.PostAsync(tokenUrl, tokenRequest);
            
            if (!tokenResponse.IsSuccessStatusCode)
            {
                var errorContent = await tokenResponse.Content.ReadAsStringAsync();
                _logger.LogError("Failed to get Keycloak admin token: {StatusCode} - {Error}", tokenResponse.StatusCode, errorContent);
                throw new InvalidOperationException($"Failed to authenticate with Keycloak: {errorContent}");
            }
            
            tokenResponse.EnsureSuccessStatusCode();

            var tokenData = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
            var accessToken = tokenData.GetProperty("access_token").GetString();
            
            if (string.IsNullOrEmpty(accessToken))
            {
                throw new InvalidOperationException("Access token is null or empty");
            }

            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            
            _logger.LogInformation("Successfully authenticated with Keycloak");

            return client;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting authenticated Keycloak client");
            throw;
        }
    }

    // POST: api/user-management
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateMasterUserRequest request)
    {
        try
        {
            // Check if user already exists with this email
            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var existingUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email == request.Email);
                if (existingUser != null)
                {
                    return BadRequest(new { message = "User with this email already exists" });
                }
            }

            // Create user in Keycloak first to get proper KeycloakUserId
            string? keycloakUserId = null;
            string? keycloakUsername = null;
            try
            {
                var client = await GetAuthenticatedKeycloakClient();
                var authority = _configuration["Oidc:Authority"];
                var realm = authority?.Split("/").Last();
                var createUserUrl = $"{authority?.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users";

                keycloakUsername = request.Email ?? $"{request.FirstName?.ToLower()}.{request.LastName?.ToLower()}";
                var keycloakUser = new
                {
                    username = keycloakUsername,
                    email = request.Email,
                    firstName = request.FirstName,
                    lastName = request.LastName,
                    enabled = true,
                    emailVerified = false
                };

                var response = await client.PostAsJsonAsync(createUserUrl, keycloakUser);
                
                if (response.IsSuccessStatusCode)
                {
                    // Get the created user's ID from Location header
                    var locationHeader = response.Headers.Location?.ToString();
                    if (!string.IsNullOrEmpty(locationHeader))
                    {
                        keycloakUserId = locationHeader.Split('/').Last();
                        _logger.LogInformation("✓ Created Keycloak user with ID: {KeycloakUserId}", keycloakUserId);
                    }
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("⚠️ Failed to create user in Keycloak: {Error}. Creating local user without Keycloak integration.", error);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "⚠️ Failed to create user in Keycloak. Creating local user without Keycloak integration.");
            }

            var newUser = new User
            {
                FirstName = request.FirstName ?? string.Empty,
                LastName = request.LastName ?? string.Empty,
                Email = request.Email ?? string.Empty,
                Username = keycloakUsername,
                KeycloakUserId = keycloakUserId, // Set the Keycloak ID if we got it
                SupervisorId = request.SupervisorId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            // Assign roles if provided
            if (request.RoleIds != null && request.RoleIds.Any())
            {
                foreach (var roleId in request.RoleIds)
                {
                    _context.UserRoles.Add(new UserRole
                    {
                        UserId = newUser.Id,
                        RoleId = roleId,
                        AssignedAt = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();
            }

            // Assign groups if provided
            if (request.GroupIds != null && request.GroupIds.Any())
            {
                foreach (var groupId in request.GroupIds)
                {
                    _context.UserGroups.Add(new UserGroup
                    {
                        UserId = newUser.Id,
                        GroupId = groupId,
                        AssignedAt = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();
            }

            // Load the created user with relationships (without circular Supervisor reference)
            var createdUser = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == newUser.Id)
                .Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    SupervisorId = u.SupervisorId,
                    Supervisor = u.SupervisorId.HasValue ? new
                    {
                        Id = u.Supervisor!.Id,
                        FirstName = u.Supervisor.FirstName,
                        LastName = u.Supervisor.LastName,
                        Email = u.Supervisor.Email
                    } : null,
                    Roles = u.UserRoles.Select(ur => new
                    {
                        ur.Role.Id,
                        ur.Role.Name,
                        ur.Role.Description
                    }).ToList(),
                    Groups = u.UserGroups.Select(ug => new
                    {
                        ug.Group.Id,
                        ug.Group.Name,
                        ug.Group.Description
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            return Ok(createdUser);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user");
            return StatusCode(500, new { message = "Failed to create user", error = ex.Message });
        }
    }

    // GET: api/user-management
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        try
        {
            // Project to DTOs immediately to avoid loading Supervisor navigation property
            var users = await _context.Users
                .AsNoTracking()
                .Select(u => new
                {
                    u.Id,
                    u.KeycloakUserId,
                    u.FirstName,
                    u.LastName,
                    u.Email,
                    u.SupervisorId,
                    u.DefaultWorkspaceId,
                    Roles = u.UserRoles.Select(ur => new
                    {
                        id = ur.Role.Id,
                        name = ur.Role.Name,
                        description = ur.Role.Description
                    }).ToList(),
                    Groups = u.UserGroups.Select(ug => new
                    {
                        id = ug.Group.Id,
                        name = ug.Group.Name,
                        description = ug.Group.Description
                    }).ToList(),
                    Workspaces = u.UserWorkspaces.Where(uw => uw.Workspace.DeletedAt == null).Select(uw => new
                    {
                        id = uw.Workspace.Id,
                        title = uw.Workspace.Title,
                        name = uw.Workspace.Name,
                        color = uw.Workspace.Color,
                        icon = uw.Workspace.Icon
                    }).ToList()
                })
                .ToListAsync();

            // Load supervisor details separately
            var supervisorIds = users.Where(u => u.SupervisorId.HasValue).Select(u => u.SupervisorId!.Value).Distinct().ToList();
            var supervisors = await _context.Users
                .AsNoTracking()
                .Where(u => supervisorIds.Contains(u.Id))
                .Select(u => new { id = u.Id, firstName = u.FirstName, lastName = u.LastName, email = u.Email })
                .ToListAsync();

            // Load default workspaces separately (in case user has DefaultWorkspaceId but no UserWorkspace entry)
            var defaultWorkspaceIds = users.Where(u => u.DefaultWorkspaceId.HasValue).Select(u => u.DefaultWorkspaceId!.Value).Distinct().ToList();
            var defaultWorkspaces = await _context.Workspaces
                .AsNoTracking()
                .Where(w => defaultWorkspaceIds.Contains(w.Id) && w.DeletedAt == null)
                .Select(w => new { id = w.Id, title = w.Title, name = w.Name, color = w.Color, icon = w.Icon })
                .ToListAsync();

            // Fetch zones from workspace database using local User.Id  
            var localUserIds = users.Select(u => u.Id.ToString()).ToList();
            var userZonesMap = new Dictionary<int, List<object>>();
            
            if (localUserIds.Any())
            {
                try
                {
                    // Convert string user IDs to integers
                    var systemUserIds = localUserIds
                        .Select(id => int.TryParse(id, out var num) ? (int?)num : null)
                        .Where(id => id.HasValue)
                        .Select(id => id!.Value)
                        .ToList();
                        
                    var userZones = await _appContext.UserZones
                        .AsNoTracking()
                        .Where(uz => systemUserIds.Contains(uz.UserId))
                        .Join(_appContext.Zones,
                            uz => uz.ZoneId,
                            z => z.Id,
                            (uz, z) => new
                            {
                                UserId = uz.UserId,
                                Zone = new
                                {
                                    id = z.Id,
                                    name = z.Name,
                                    color = z.Color
                                }
                            })
                        .ToListAsync();

                    foreach (var uz in userZones)
                    {
                        if (!userZonesMap.ContainsKey(uz.UserId))
                        {
                            userZonesMap[uz.UserId] = new List<object>();
                        }
                        userZonesMap[uz.UserId].Add(uz.Zone);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error fetching zones for users");
                    // Continue without zones if there's an error
                }
            }

            // Fetch enabled status from Keycloak for users with KeycloakUserId
            var enabledStatusMap = new Dictionary<string, bool>();
            var usersWithKeycloakId = users.Where(u => !string.IsNullOrEmpty(u.KeycloakUserId)).ToList();
            
            if (usersWithKeycloakId.Any())
            {
                try
                {
                    var client = await GetAuthenticatedKeycloakClient();
                    var authority = _configuration["Oidc:Authority"];
                    if (!string.IsNullOrEmpty(authority))
                    {
                        var realm = authority.Split("/").Last();
                        
                        foreach (var user in usersWithKeycloakId)
                        {
                            try
                            {
                                var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{user.KeycloakUserId}";
                                var response = await client.GetAsync(url);
                                if (response.IsSuccessStatusCode)
                                {
                                    var keycloakUser = await response.Content.ReadFromJsonAsync<JsonElement>();
                                    var enabled = keycloakUser.TryGetProperty("enabled", out var enabledProp) ? enabledProp.GetBoolean() : true;
                                    enabledStatusMap[user.KeycloakUserId!] = enabled;
                                }
                            }
                            catch
                            {
                                // If we can't fetch from Keycloak, default to true
                                enabledStatusMap[user.KeycloakUserId!] = true;
                            }
                        }
                    }
                }
                catch
                {
                    // If Keycloak is unreachable, default all to true
                }
            }

            // Combine the data
            var userResponses = users.Select(u => new
            {
                id = u.Id,
                keycloakUserId = u.KeycloakUserId,
                firstName = u.FirstName,
                lastName = u.LastName,
                email = u.Email,
                enabled = !string.IsNullOrEmpty(u.KeycloakUserId) && enabledStatusMap.ContainsKey(u.KeycloakUserId)
                    ? enabledStatusMap[u.KeycloakUserId]
                    : true,
                supervisorId = u.SupervisorId,
                supervisor = u.SupervisorId.HasValue
                    ? supervisors.FirstOrDefault(s => s.id == u.SupervisorId.Value)
                    : null,
                defaultWorkspaceId = u.DefaultWorkspaceId,
                defaultWorkspace = u.DefaultWorkspaceId.HasValue
                    ? defaultWorkspaces.FirstOrDefault(w => w.id == u.DefaultWorkspaceId.Value)
                    : null,
                roles = u.Roles,
                groups = u.Groups,
                zones = userZonesMap.ContainsKey(u.Id)
                    ? userZonesMap[u.Id]
                    : new List<object>(),
                workspaces = u.Workspaces
            }).ToList();

            _logger.LogInformation($"Returning {userResponses.Count} users with roles and groups");

            Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
            Response.Headers.Append("Pragma", "no-cache");
            Response.Headers.Append("Expires", "0");
            
            return Ok(userResponses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching users");
            return StatusCode(500, new { message = "Failed to fetch users", error = ex.Message });
        }
    }

    // GET: api/user-management/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(int id)
    {
        try
        {
            var user = await _context.Users
                .Include(u => u.Supervisor)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserGroups)
                    .ThenInclude(ug => ug.Group)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Fetch enabled status from Keycloak if user has KeycloakUserId
            bool enabled = true;
            if (!string.IsNullOrEmpty(user.KeycloakUserId))
            {
                try
                {
                    var client = await GetAuthenticatedKeycloakClient();
                    var authority = _configuration["Oidc:Authority"];
                    if (!string.IsNullOrEmpty(authority))
                    {
                        var realm = authority.Split("/").Last();
                        var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{user.KeycloakUserId}";
                        var response = await client.GetAsync(url);
                        if (response.IsSuccessStatusCode)
                        {
                            var keycloakUser = await response.Content.ReadFromJsonAsync<JsonElement>();
                            enabled = keycloakUser.TryGetProperty("enabled", out var enabledProp) ? enabledProp.GetBoolean() : true;
                        }
                    }
                }
                catch
                {
                    // If we can't fetch from Keycloak, default to true
                }
            }

            var userResponse = new
            {
                id = user.Id,
                keycloakUserId = user.KeycloakUserId,
                firstName = user.FirstName,
                lastName = user.LastName,
                email = user.Email,
                enabled = enabled,
                supervisorId = user.SupervisorId,
                supervisor = user.Supervisor != null ? new
                {
                    id = user.Supervisor.Id,
                    firstName = user.Supervisor.FirstName,
                    lastName = user.Supervisor.LastName,
                    email = user.Supervisor.Email
                } : null,
                roles = user.UserRoles.Select(ur => new
                {
                    id = ur.Role.Id,
                    name = ur.Role.Name,
                    description = ur.Role.Description
                }).ToList(),
                groups = user.UserGroups.Select(ug => new
                {
                    id = ug.Group.Id,
                    name = ug.Group.Name,
                    description = ug.Group.Description
                }).ToList()
            };

            return Ok(userResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user {UserId}", id);
            return StatusCode(500, new { message = "Failed to fetch user", error = ex.Message });
        }
    }

    // PUT: api/user-management/{id}/supervisor
    [HttpPut("{id}/supervisor")]
    public async Task<IActionResult> UpdateSupervisor(int id, [FromBody] UpdateSupervisorRequest request)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Validate supervisor exists if provided
            if (request.SupervisorId.HasValue)
            {
                var supervisor = await _context.Users.FindAsync(request.SupervisorId.Value);
                if (supervisor == null)
                {
                    return BadRequest(new { message = "Supervisor not found" });
                }

                // Prevent self-supervision
                if (request.SupervisorId.Value == id)
                {
                    return BadRequest(new { message = "User cannot be their own supervisor" });
                }
            }

            user.SupervisorId = request.SupervisorId;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Supervisor updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating supervisor for user {UserId}", id);
            return StatusCode(500, new { message = "Failed to update supervisor", error = ex.Message });
        }
    }

    // GET: api/user-management/roles
    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles([FromQuery] bool includeDeleted = false)
    {
        try
        {
            var roles = includeDeleted
                ? await _context.Roles
                    .Include(r => r.UserRoles)
                    .Include(r => r.RolePermissions)
                    .Where(r => r.IsDeleted)
                    .ToListAsync()
                : await _context.Roles
                    .Include(r => r.UserRoles)
                    .Include(r => r.RolePermissions)
                    .Where(r => !r.IsDeleted)
                    .ToListAsync();
            
            var rolesWithCount = roles.Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                r.Icon,
                r.Color,
                r.CreatedAt,
                r.IsDeleted,
                r.DeletedAt,
                UserCount = r.UserRoles.Count,
                PermissionCount = r.RolePermissions.Count
            });
            
            return Ok(rolesWithCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching roles");
            return StatusCode(500, new { message = "Failed to fetch roles", error = ex.Message });
        }
    }

    // POST: api/user-management/roles
    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] CreateUserRoleRequest request)
    {
        try
        {
            // Check if role with same name already exists
            if (await _context.Roles.AnyAsync(r => r.Name == request.Name))
            {
                return BadRequest(new { message = "Role with this name already exists" });
            }

            var role = new Role
            {
                Name = request.Name,
                Description = request.Description,
                Icon = request.Icon,
                Color = request.Color,
                CreatedAt = DateTime.UtcNow
            };

            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            return Ok(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role");
            return StatusCode(500, new { message = "Failed to create role", error = ex.Message });
        }
    }

    // PUT: api/user-management/roles/{id}
    [HttpPut("roles/{id}")]
    public async Task<IActionResult> UpdateRole(int id, [FromBody] CreateUserRoleRequest request)
    {
        try
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null)
            {
                return NotFound(new { message = "Role not found" });
            }

            // Check if another role has the same name (excluding current role)
            if (await _context.Roles.AnyAsync(r => r.Name == request.Name && r.Id != id))
            {
                return BadRequest(new { message = "Role with this name already exists" });
            }

            role.Name = request.Name;
            role.Description = request.Description;
            role.Icon = request.Icon;
            role.Color = request.Color;

            await _context.SaveChangesAsync();

            return Ok(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role {RoleId}", id);
            return StatusCode(500, new { message = "Failed to update role", error = ex.Message });
        }
    }

    // DELETE: api/user-management/roles/{id}
    [HttpDelete("roles/{id}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        try
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null || role.IsDeleted)
            {
                return NotFound(new { message = "Role not found" });
            }

            role.IsDeleted = true;
            role.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Role deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role {RoleId}", id);
            return StatusCode(500, new { message = "Failed to delete role", error = ex.Message });
        }
    }

    // GET: api/user-management/groups
    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups([FromQuery] bool includeDeleted = false)
    {
        try
        {
            var groups = includeDeleted 
                ? await _context.Groups
                    .Include(g => g.UserGroups)
                    .Where(g => g.IsDeleted)
                    .ToListAsync()
                : await _context.Groups
                    .Include(g => g.UserGroups)
                    .Where(g => !g.IsDeleted)
                    .ToListAsync();
            
            var groupsWithCount = groups.Select(g => new
            {
                g.Id,
                g.Name,
                g.Description,
                g.Icon,
                g.Color,
                g.CreatedAt,
                g.IsDeleted,
                g.DeletedAt,
                UserCount = g.UserGroups.Count
            });
            
            return Ok(groupsWithCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching groups");
            return StatusCode(500, new { message = "Failed to fetch groups", error = ex.Message });
        }
    }

    // POST: api/user-management/groups
    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateUserGroupRequest request)
    {
        try
        {
            // Check if group with same name already exists
            if (await _context.Groups.AnyAsync(g => g.Name == request.Name))
            {
                return BadRequest(new { message = "Group with this name already exists" });
            }

            var group = new Group
            {
                Name = request.Name,
                Description = request.Description,
                Icon = request.Icon,
                Color = request.Color,
                CreatedAt = DateTime.UtcNow
            };

            _context.Groups.Add(group);
            await _context.SaveChangesAsync();

            return Ok(group);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating group");
            return StatusCode(500, new { message = "Failed to create group", error = ex.Message });
        }
    }

    // PUT: api/user-management/groups/{id}
    [HttpPut("groups/{id}")]
    public async Task<IActionResult> UpdateGroup(int id, [FromBody] CreateUserGroupRequest request)
    {
        try
        {
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound(new { message = "Group not found" });
            }

            // Check if another group has the same name (excluding current group)
            if (await _context.Groups.AnyAsync(g => g.Name == request.Name && g.Id != id))
            {
                return BadRequest(new { message = "Group with this name already exists" });
            }

            group.Name = request.Name;
            group.Description = request.Description;
            group.Icon = request.Icon;
            group.Color = request.Color;

            await _context.SaveChangesAsync();

            return Ok(group);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating group {GroupId}", id);
            return StatusCode(500, new { message = "Failed to update group", error = ex.Message });
        }
    }

    // DELETE: api/user-management/groups/{id}
    [HttpDelete("groups/{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        try
        {
            var group = await _context.Groups.FindAsync(id);
            if (group == null || group.IsDeleted)
            {
                return NotFound(new { message = "Group not found" });
            }

            group.IsDeleted = true;
            group.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Group deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting group {GroupId}", id);
            return StatusCode(500, new { message = "Failed to delete group", error = ex.Message });
        }
    }

    // POST: api/user-management/roles/{id}/restore
    [HttpPost("roles/{id}/restore")]
    public async Task<IActionResult> RestoreRole(int id)
    {
        try
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null)
            {
                return NotFound(new { message = "Role not found" });
            }

            if (!role.IsDeleted)
            {
                return BadRequest(new { message = "Role is not deleted" });
            }

            role.IsDeleted = false;
            role.DeletedAt = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Role restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring role {RoleId}", id);
            return StatusCode(500, new { message = "Failed to restore role", error = ex.Message });
        }
    }

    // POST: api/user-management/groups/{id}/restore
    [HttpPost("groups/{id}/restore")]
    public async Task<IActionResult> RestoreGroup(int id)
    {
        try
        {
            var group = await _context.Groups.FindAsync(id);
            if (group == null)
            {
                return NotFound(new { message = "Group not found" });
            }

            if (!group.IsDeleted)
            {
                return BadRequest(new { message = "Group is not deleted" });
            }

            group.IsDeleted = false;
            group.DeletedAt = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Group restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring group {GroupId}", id);
            return StatusCode(500, new { message = "Failed to restore group", error = ex.Message });
        }
    }

    // POST: api/user-management/{id}/roles
    [HttpPost("{id}/roles")]
    public async Task<IActionResult> AssignRolesToUser(int id, [FromBody] List<int> roleIds)
    {
        try
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Remove existing roles
            _context.UserRoles.RemoveRange(user.UserRoles);

            // Add new roles
            foreach (var roleId in roleIds)
            {
                var role = await _context.Roles.FindAsync(roleId);
                if (role != null)
                {
                    _context.UserRoles.Add(new UserRole
                    {
                        UserId = id,
                        RoleId = roleId,
                        AssignedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Roles assigned successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning roles to user {UserId}", id);
            return StatusCode(500, new { message = "Failed to assign roles", error = ex.Message });
        }
    }

    // POST: api/user-management/{id}/groups
    [HttpPost("{id}/groups")]
    public async Task<IActionResult> AssignGroupsToUser(int id, [FromBody] List<int> groupIds)
    {
        try
        {
            var user = await _context.Users
                .Include(u => u.UserGroups)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Remove existing groups
            _context.UserGroups.RemoveRange(user.UserGroups);

            // Add new groups
            foreach (var groupId in groupIds)
            {
                var group = await _context.Groups.FindAsync(groupId);
                if (group != null)
                {
                    _context.UserGroups.Add(new UserGroup
                    {
                        UserId = id,
                        GroupId = groupId,
                        AssignedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Groups assigned successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning groups to user {UserId}", id);
            return StatusCode(500, new { message = "Failed to assign groups", error = ex.Message });
        }
    }

    // ===== PERMISSIONS API =====

    // GET: api/user-management/permissions
    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions([FromQuery] bool includeDeleted = false)
    {
        try
        {
            var permissions = includeDeleted
                ? await _context.Permissions.Where(p => p.IsDeleted).ToListAsync()
                : await _context.Permissions.Where(p => !p.IsDeleted).ToListAsync();
            return Ok(permissions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching permissions");
            return StatusCode(500, new { message = "Failed to fetch permissions", error = ex.Message });
        }
    }

    // POST: api/user-management/permissions
    [HttpPost("permissions")]
    public async Task<IActionResult> CreatePermission([FromBody] CreatePermissionRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { message = "Permission name is required" });
            }

            var permission = new Permission
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                Category = request.Category?.Trim() ?? "General",
                CreatedAt = DateTime.UtcNow
            };

            _context.Permissions.Add(permission);
            await _context.SaveChangesAsync();

            return Ok(permission);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("IX_Permissions_Name") == true)
        {
            return Conflict(new { message = "A permission with this name already exists" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating permission");
            return StatusCode(500, new { message = "Failed to create permission", error = ex.Message });
        }
    }

    // DELETE: api/user-management/permissions/{id}
    [HttpDelete("permissions/{id}")]
    public async Task<IActionResult> DeletePermission(int id)
    {
        try
        {
            var permission = await _context.Permissions.FindAsync(id);
            if (permission == null)
            {
                return NotFound(new { message = "Permission not found" });
            }

            permission.IsDeleted = true;
            permission.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Permission deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting permission {PermissionId}", id);
            return StatusCode(500, new { message = "Failed to delete permission", error = ex.Message });
        }
    }

    // POST: api/user-management/permissions/{id}/restore
    [HttpPost("permissions/{id}/restore")]
    public async Task<IActionResult> RestorePermission(int id)
    {
        try
        {
            var permission = await _context.Permissions.FindAsync(id);
            if (permission == null)
            {
                return NotFound(new { message = "Permission not found" });
            }

            permission.IsDeleted = false;
            permission.DeletedAt = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Permission restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring permission {PermissionId}", id);
            return StatusCode(500, new { message = "Failed to restore permission", error = ex.Message });
        }
    }

    // GET: api/user-management/roles/{roleId}/permissions
    [HttpGet("roles/{roleId}/permissions")]
    public async Task<IActionResult> GetRolePermissions(int roleId)
    {
        try
        {
            var rolePermissions = await _context.RolePermissions
                .Include(rp => rp.Permission)
                .Where(rp => rp.RoleId == roleId)
                .Select(rp => rp.Permission)
                .ToListAsync();

            return Ok(rolePermissions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching permissions for role {RoleId}", roleId);
            return StatusCode(500, new { message = "Failed to fetch role permissions", error = ex.Message });
        }
    }

    // POST: api/user-management/roles/{roleId}/permissions
    [HttpPost("roles/{roleId}/permissions")]
    public async Task<IActionResult> AssignPermissionsToRole(int roleId, [FromBody] List<int> permissionIds)
    {
        try
        {
            var role = await _context.Roles.FindAsync(roleId);
            if (role == null)
            {
                return NotFound(new { message = "Role not found" });
            }

            // Remove existing permissions
            var existing = await _context.RolePermissions
                .Where(rp => rp.RoleId == roleId)
                .ToListAsync();
            _context.RolePermissions.RemoveRange(existing);

            // Add new permissions
            foreach (var permissionId in permissionIds)
            {
                var permission = await _context.Permissions.FindAsync(permissionId);
                if (permission != null)
                {
                    _context.RolePermissions.Add(new RolePermission
                    {
                        RoleId = roleId,
                        PermissionId = permissionId,
                        AssignedAt = DateTime.UtcNow
                    });
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Permissions assigned successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning permissions to role {RoleId}", roleId);
            return StatusCode(500, new { message = "Failed to assign permissions", error = ex.Message });
        }
    }

    // GET: api/user-management/{id}/workspaces
    [HttpGet("{id}/workspaces")]
    public async Task<IActionResult> GetUserWorkspaces(int id)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var workspaces = await _context.UserWorkspaces
                .Include(uw => uw.Workspace)
                .Where(uw => uw.UserId == id && uw.Workspace.DeletedAt == null)
                .Select(uw => new
                {
                    uw.Workspace.Id,
                    uw.Workspace.Title,
                    uw.Workspace.Name,
                    uw.Workspace.Location,
                    uw.Workspace.Color,
                    uw.Workspace.Icon,
                    uw.AssignedAt,
                    uw.AssignedBy
                })
                .ToListAsync();

            return Ok(workspaces);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching workspaces for user {UserId}", id);
            return StatusCode(500, new { message = "Failed to fetch user workspaces", error = ex.Message });
        }
    }

    // POST: api/user-management/{id}/workspaces
    [HttpPost("{id}/workspaces")]
    public async Task<IActionResult> AssignWorkspacesToUser(int id, [FromBody] List<int> workspaceIds)
    {
        try
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var currentUserName = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value ?? "Unknown";

            // Remove existing workspace assignments
            var existing = await _context.UserWorkspaces
                .Where(uw => uw.UserId == id)
                .ToListAsync();
            _context.UserWorkspaces.RemoveRange(existing);

            // Add new workspace assignments
            foreach (var workspaceId in workspaceIds)
            {
                var workspace = await _context.Workspaces.FindAsync(workspaceId);
                if (workspace != null && workspace.DeletedAt == null)
                {
                    _context.UserWorkspaces.Add(new UserWorkspace
                    {
                        UserId = id,
                        WorkspaceId = workspaceId,
                        AssignedAt = DateTime.UtcNow,
                        AssignedBy = currentUserName
                    });
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Workspaces assigned successfully", count = workspaceIds.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error assigning workspaces to user {UserId}", id);
            return StatusCode(500, new { message = "Failed to assign workspaces", error = ex.Message });
        }
    }

    // GET: api/user-management/workspaces/available
    [HttpGet("workspaces/available")]
    public async Task<IActionResult> GetAvailableWorkspaces()
    {
        try
        {
            var workspaces = await _context.Workspaces
                .Where(w => w.DeletedAt == null && w.Status == "active")
                .OrderBy(w => w.Title)
                .Select(w => new
                {
                    w.Id,
                    w.Title,
                    w.Name,
                    w.Location,
                    w.Color,
                    w.Icon
                })
                .ToListAsync();

            return Ok(workspaces);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching available workspaces");
            return StatusCode(500, new { message = "Failed to fetch workspaces", error = ex.Message });
        }
    }
}

// Request models
public class CreateMasterUserRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public int? SupervisorId { get; set; }
    public List<int>? RoleIds { get; set; }
    public List<int>? GroupIds { get; set; }
}

public class UpdateSupervisorRequest
{
    public int? SupervisorId { get; set; }
}

public class CreateUserRoleRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
}

public class CreateUserGroupRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
}

public class CreatePermissionRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
}
