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
    private readonly ILogger<UserManagementDbController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public UserManagementDbController(
        MasterDbContext context, 
        ILogger<UserManagementDbController> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _context = context;
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
            var client = await GetAuthenticatedKeycloakClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users?max=1000";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var keycloakUsers = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            
            if (keycloakUsers == null)
            {
                return Ok(new { message = "No users found in Keycloak", syncedCount = 0 });
            }

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
                        FirstName = firstName ?? string.Empty,
                        LastName = lastName ?? string.Empty,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.Users.Add(newUser);
                    syncedCount++;
                }
                else
                {
                    // Update existing user
                    if (string.IsNullOrEmpty(existingUser.KeycloakUserId))
                    {
                        existingUser.KeycloakUserId = keycloakUserId;
                    }
                    existingUser.Email = finalEmail;
                    existingUser.FirstName = firstName ?? string.Empty;
                    existingUser.LastName = lastName ?? string.Empty;
                    updatedCount++;
                }
            }

            await _context.SaveChangesAsync();

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
            _logger.LogError(ex, "Error syncing Keycloak users");
            return StatusCode(500, new { error = "Failed to sync Keycloak users", message = ex.Message });
        }
    }

    private async Task<HttpClient> GetAuthenticatedKeycloakClient()
    {
        var client = _httpClientFactory.CreateClient();
        var authority = _configuration["Oidc:Authority"];
        if (string.IsNullOrEmpty(authority))
        {
            throw new InvalidOperationException("Oidc:Authority configuration is missing");
        }
        
        var realm = authority.Split("/").Last();
        var tokenUrl = $"{authority.Replace($"/realms/{realm}", "")}/realms/{realm}/protocol/openid-connect/token";

        var tokenRequest = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials"),
            new KeyValuePair<string, string>("client_id", _configuration["KeycloakAdmin:ClientId"] ?? "openradius-admin"),
            new KeyValuePair<string, string>("client_secret", _configuration["KeycloakAdmin:ClientSecret"] ?? "")
        });

        var tokenResponse = await client.PostAsync(tokenUrl, tokenRequest);
        tokenResponse.EnsureSuccessStatusCode();

        var tokenData = await tokenResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = tokenData.GetProperty("access_token").GetString();

        var authenticatedClient = _httpClientFactory.CreateClient();
        authenticatedClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        authenticatedClient.DefaultRequestHeaders.CacheControl = 
            new System.Net.Http.Headers.CacheControlHeaderValue { NoCache = true, NoStore = true };

        return authenticatedClient;
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

            var newUser = new User
            {
                FirstName = request.FirstName ?? string.Empty,
                LastName = request.LastName ?? string.Empty,
                Email = request.Email ?? string.Empty,
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
                roles = u.Roles,
                groups = u.Groups
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
    public async Task<IActionResult> GetRoles()
    {
        try
        {
            var roles = await _context.Roles.ToListAsync();
            return Ok(roles);
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
            if (role == null)
            {
                return NotFound(new { message = "Role not found" });
            }

            _context.Roles.Remove(role);
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
    public async Task<IActionResult> GetGroups()
    {
        try
        {
            var groups = await _context.Groups.ToListAsync();
            return Ok(groups);
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
            if (group == null)
            {
                return NotFound(new { message = "Group not found" });
            }

            _context.Groups.Remove(group);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Group deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting group {GroupId}", id);
            return StatusCode(500, new { message = "Failed to delete group", error = ex.Message });
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
    public async Task<IActionResult> GetPermissions()
    {
        try
        {
            var permissions = await _context.Permissions.ToListAsync();
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

            _context.Permissions.Remove(permission);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Permission deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting permission {PermissionId}", id);
            return StatusCode(500, new { message = "Failed to delete permission", error = ex.Message });
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
