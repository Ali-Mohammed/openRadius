using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Backend.Models;
using Backend.Data;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/keycloak/users")]
[Authorize]
public class UserManagementController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<UserManagementController> _logger;
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private string? _adminToken;
    private DateTime _tokenExpiry = DateTime.MinValue;

    public UserManagementController(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<UserManagementController> logger,
        ApplicationDbContext context,
        MasterDbContext masterContext,
        IHttpContextAccessor httpContextAccessor)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _context = context;
        _masterContext = masterContext;
        _httpContextAccessor = httpContextAccessor;
    }

    private string? GetCurrentUserId()
    {
        return _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
    }

    private async Task<string> GetAdminToken()
    {
        if (_adminToken != null && DateTime.UtcNow < _tokenExpiry)
        {
            return _adminToken;
        }

        var client = _httpClientFactory.CreateClient();
        var authority = _configuration["Oidc:Authority"];
        var tokenUrl = $"{authority}/protocol/openid-connect/token";

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials"),
            new KeyValuePair<string, string>("client_id", _configuration["KeycloakAdmin:ClientId"] ?? "openradius-admin"),
            new KeyValuePair<string, string>("client_secret", _configuration["KeycloakAdmin:ClientSecret"] ?? "")
        });

        var response = await client.PostAsync(tokenUrl, content);
        response.EnsureSuccessStatusCode();

        var tokenResponse = await response.Content.ReadFromJsonAsync<JsonElement>();
        _adminToken = tokenResponse.GetProperty("access_token").GetString();
        var expiresIn = tokenResponse.GetProperty("expires_in").GetInt32();
        _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn - 60); // Refresh 60 seconds early

        return _adminToken ?? "";
    }

    private async Task<HttpClient> GetAuthenticatedClient()
    {
        var token = await GetAdminToken();
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // GET: api/users
    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] int? first, [FromQuery] int? max, [FromQuery] string? search)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            var realm = authority?.Split("/").Last();
            
            var queryParams = new List<string>();
            if (first.HasValue) queryParams.Add($"first={first.Value}");
            if (max.HasValue) queryParams.Add($"max={max.Value}");
            if (!string.IsNullOrWhiteSpace(search)) queryParams.Add($"search={Uri.EscapeDataString(search)}");
            
            var queryString = queryParams.Any() ? "?" + string.Join("&", queryParams) : "";
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users{queryString}";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var users = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            
            var userResponses = new List<KeycloakUserResponse>();
            
            if (users != null)
            {
                foreach (var u in users)
                {
                    var userId = u.TryGetProperty("id", out var id) ? id.GetString() : null;
                    
                    // Fetch groups for this user
                    List<string>? userGroups = null;
                    if (!string.IsNullOrEmpty(userId))
                    {
                        try
                        {
                            var groupsUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{userId}/groups";
                            var groupsResponse = await client.GetAsync(groupsUrl);
                            if (groupsResponse.IsSuccessStatusCode)
                            {
                                var groups = await groupsResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
                                userGroups = groups?.Select(g => g.GetProperty("name").GetString()).Where(n => n != null).Select(n => n!).ToList();
                            }
                        }
                        catch { /* Ignore group fetch errors */ }
                    }
                    
                    // Fetch realm roles for this user
                    List<string>? realmRoles = null;
                    if (!string.IsNullOrEmpty(userId))
                    {
                        try
                        {
                            var rolesUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{userId}/role-mappings/realm";
                            var rolesResponse = await client.GetAsync(rolesUrl);
                            if (rolesResponse.IsSuccessStatusCode)
                            {
                                var roles = await rolesResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
                                realmRoles = roles?.Select(r => r.GetProperty("name").GetString()).Where(n => n != null).Select(n => n!).ToList();
                            }
                        }
                        catch { /* Ignore role fetch errors */ }
                    }
                    
                    // Extract supervisor from attributes
                    string? supervisorId = null;
                    string? supervisorName = null;
                    if (u.TryGetProperty("attributes", out var attrs) && attrs.TryGetProperty("supervisorId", out var supIdArray))
                    {
                        supervisorId = supIdArray.EnumerateArray().FirstOrDefault().GetString();
                        
                        // Fetch supervisor details if supervisorId exists
                        if (!string.IsNullOrEmpty(supervisorId))
                        {
                            try
                            {
                                var supervisorUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{supervisorId}";
                                var supervisorResponse = await client.GetAsync(supervisorUrl);
                                if (supervisorResponse.IsSuccessStatusCode)
                                {
                                    var supervisor = await supervisorResponse.Content.ReadFromJsonAsync<JsonElement>();
                                    var supFirstName = supervisor.TryGetProperty("firstName", out var fn) ? fn.GetString() : null;
                                    var supLastName = supervisor.TryGetProperty("lastName", out var ln) ? ln.GetString() : null;
                                    var supUsername = supervisor.TryGetProperty("username", out var un) ? un.GetString() : null;
                                    
                                    if (!string.IsNullOrEmpty(supFirstName) || !string.IsNullOrEmpty(supLastName))
                                    {
                                        supervisorName = $"{supFirstName} {supLastName}".Trim();
                                    }
                                    else
                                    {
                                        supervisorName = supUsername;
                                    }
                                }
                            }
                            catch { /* Ignore supervisor fetch errors */ }
                        }
                    }
                    
                    // Fetch zones for this user
                    List<ZoneInfo>? userZones = null;
                    if (!string.IsNullOrEmpty(userId) && int.TryParse(userId, out var systemUserId))
                    {
                        try
                        {
                            var zones = await _context.UserZones
                                .Where(uz => uz.UserId == systemUserId)
                                .Join(_context.Zones,
                                    uz => uz.ZoneId,
                                    z => z.Id,
                                    (uz, z) => new ZoneInfo
                                    {
                                        Id = z.Id,
                                        Name = z.Name,
                                        Color = z.Color
                                    })
                                .ToListAsync();
                            userZones = zones;
                        }
                        catch { /* Ignore zone fetch errors */ }
                    }
                    
                    userResponses.Add(new KeycloakUserResponse
                    {
                        Id = userId,
                        Username = u.TryGetProperty("username", out var username) ? username.GetString() : null,
                        Email = u.TryGetProperty("email", out var email) ? email.GetString() : null,
                        FirstName = u.TryGetProperty("firstName", out var firstName) ? firstName.GetString() : null,
                        LastName = u.TryGetProperty("lastName", out var lastName) ? lastName.GetString() : null,
                        Enabled = u.TryGetProperty("enabled", out var enabled) ? enabled.GetBoolean() : true,
                        EmailVerified = u.TryGetProperty("emailVerified", out var emailVerified) ? emailVerified.GetBoolean() : false,
                        CreatedTimestamp = u.TryGetProperty("createdTimestamp", out var createdTimestamp) ? createdTimestamp.GetInt64() : null,
                        Groups = userGroups,
                        RealmRoles = realmRoles,
                        SupervisorId = supervisorId,
                        Supervisor = supervisorName,
                        Zones = userZones
                    });
                }
            }

            return Ok(userResponses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching users from Keycloak");
            return StatusCode(500, new { message = "Failed to fetch users", error = ex.Message });
        }
    }

    // GET: api/users/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var user = await response.Content.ReadFromJsonAsync<JsonElement>();
            
            var userResponse = new KeycloakUserResponse
            {
                Id = user.TryGetProperty("id", out var uid) ? uid.GetString() : null,
                Username = user.TryGetProperty("username", out var username) ? username.GetString() : null,
                Email = user.TryGetProperty("email", out var email) ? email.GetString() : null,
                FirstName = user.TryGetProperty("firstName", out var firstName) ? firstName.GetString() : null,
                LastName = user.TryGetProperty("lastName", out var lastName) ? lastName.GetString() : null,
                Enabled = user.TryGetProperty("enabled", out var enabled) ? enabled.GetBoolean() : true,
                EmailVerified = user.TryGetProperty("emailVerified", out var emailVerified) ? emailVerified.GetBoolean() : false,
                CreatedTimestamp = user.TryGetProperty("createdTimestamp", out var createdTimestamp) ? createdTimestamp.GetInt64() : null
            };

            return Ok(userResponse);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return NotFound(new { message = "User not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user from Keycloak");
            return StatusCode(500, new { message = "Failed to fetch user", error = ex.Message });
        }
    }

    // POST: api/users
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] KeycloakUserRequest request)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users";

            var userPayload = new
            {
                username = request.Username,
                email = request.Email,
                firstName = request.FirstName,
                lastName = request.LastName,
                enabled = request.Enabled,
                emailVerified = request.EmailVerified,
                attributes = BuildAttributes(request.Attributes, request.SupervisorId),
                credentials = !string.IsNullOrWhiteSpace(request.Password) ? new[]
                {
                    new
                    {
                        type = "password",
                        value = request.Password,
                        temporary = request.TemporaryPassword
                    }
                } : null
            };

            var content = new StringContent(JsonSerializer.Serialize(userPayload), Encoding.UTF8, "application/json");
            var response = await client.PostAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Failed to create user", error = errorContent });
            }

            // Get the created user's ID from the Location header
            var location = response.Headers.Location?.ToString();
            var userId = location?.Split('/').Last();

            // Add user to groups if specified
            if (request.Groups != null && request.Groups.Any() && !string.IsNullOrEmpty(userId))
            {
                foreach (var groupName in request.Groups)
                {
                    await AddUserToGroup(userId, groupName);
                }
            }

            return Ok(new { id = userId, message = "User created successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user in Keycloak");
            return StatusCode(500, new { message = "Failed to create user", error = ex.Message });
        }
    }

    // PUT: api/users/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] KeycloakUserRequest request)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                throw new InvalidOperationException("Oidc:Authority configuration is missing");
            }
            var realm = authority.Split("/").Last();
            
            // First, get the current user to preserve existing attributes
            var getUserUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}";
            var getUserResponse = await client.GetAsync(getUserUrl);
            getUserResponse.EnsureSuccessStatusCode();
            var currentUser = await getUserResponse.Content.ReadFromJsonAsync<JsonElement>();
            
            // Extract existing attributes
            Dictionary<string, List<string>>? existingAttributes = null;
            if (currentUser.TryGetProperty("attributes", out var attrsElement))
            {
                existingAttributes = new Dictionary<string, List<string>>();
                foreach (var prop in attrsElement.EnumerateObject())
                {
                    var values = new List<string>();
                    foreach (var val in prop.Value.EnumerateArray())
                    {
                        var strVal = val.GetString();
                        if (strVal != null) values.Add(strVal);
                    }
                    existingAttributes[prop.Name] = values;
                }
            }
            
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}";

            var userPayload = new
            {
                email = request.Email,
                firstName = request.FirstName,
                lastName = request.LastName,
                enabled = request.Enabled,
                emailVerified = request.EmailVerified,
                attributes = BuildAttributes(existingAttributes, request.SupervisorId)
            };

            var content = new StringContent(JsonSerializer.Serialize(userPayload), Encoding.UTF8, "application/json");
            var response = await client.PutAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Failed to update user", error = errorContent });
            }

            // If disabling user and reason provided, save to local database
            if (!request.Enabled && !string.IsNullOrEmpty(request.DisabledReason))
            {
                var currentUserId = GetCurrentUserId();
                var dbUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.KeycloakUserId == id);
                if (dbUser != null)
                {
                    dbUser.DisabledReason = request.DisabledReason;
                    dbUser.DisabledAt = DateTime.UtcNow;
                    dbUser.DisabledBy = currentUserId;
                    await _masterContext.SaveChangesAsync();
                }
            }
            // If enabling user, clear disable tracking
            else if (request.Enabled)
            {
                var dbUser = await _masterContext.Users.FirstOrDefaultAsync(u => u.KeycloakUserId == id);
                if (dbUser != null)
                {
                    dbUser.DisabledReason = null;
                    dbUser.DisabledAt = null;
                    dbUser.DisabledBy = null;
                    await _masterContext.SaveChangesAsync();
                }
            }

            return Ok(new { message = "User updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating user in Keycloak");
            return StatusCode(500, new { message = "Failed to update user", error = ex.Message });
        }
    }

    // DELETE: api/users/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}";

            var response = await client.DeleteAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Failed to delete user", error = errorContent });
            }

            return Ok(new { message = "User deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user from Keycloak");
            return StatusCode(500, new { message = "Failed to delete user", error = ex.Message });
        }
    }

    // PUT: api/users/{id}/reset-password
    [HttpPut("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, [FromBody] SetPasswordRequest request)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/reset-password";

            var passwordPayload = new
            {
                type = "password",
                value = request.Password,
                temporary = request.Temporary
            };

            var content = new StringContent(JsonSerializer.Serialize(passwordPayload), Encoding.UTF8, "application/json");
            var response = await client.PutAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Failed to reset password", error = errorContent });
            }

            return Ok(new { message = "Password reset successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting password in Keycloak");
            return StatusCode(500, new { message = "Failed to reset password", error = ex.Message });
        }
    }

    // GET: api/keycloak/users/groups
    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups()
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/groups";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var groups = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            
            var groupResponses = groups?.Select(g => new KeycloakGroupResponse
            {
                Id = g.TryGetProperty("id", out var id) ? id.GetString() : null,
                Name = g.TryGetProperty("name", out var name) ? name.GetString() : null,
                Path = g.TryGetProperty("path", out var path) ? path.GetString() : null
            }).ToList();

            return Ok(groupResponses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching groups from Keycloak");
            return StatusCode(500, new { message = "Failed to fetch groups", error = ex.Message });
        }
    }

    // GET: api/keycloak/users/roles
    [HttpGet("roles")]
    public async Task<IActionResult> GetRealmRoles()
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/roles";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var roles = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            
            var roleResponses = roles?.Select(r => new KeycloakRoleResponse
            {
                Id = r.TryGetProperty("id", out var id) ? id.GetString() : null,
                Name = r.TryGetProperty("name", out var name) ? name.GetString() : null,
                Description = r.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                Composite = r.TryGetProperty("composite", out var comp) && comp.GetBoolean(),
                ClientRole = r.TryGetProperty("clientRole", out var cr) && cr.GetBoolean()
            }).Where(r => !r.Name?.StartsWith("default-roles-") ?? true).ToList();

            return Ok(roleResponses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching realm roles from Keycloak");
            return StatusCode(500, new { message = "Failed to fetch roles", error = ex.Message });
        }
    }

    // GET: api/keycloak/users/{id}/roles
    [HttpGet("{id}/roles")]
    public async Task<IActionResult> GetUserRoles(string id)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/role-mappings/realm";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var roles = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            var roleNames = roles?.Select(r => 
                r.TryGetProperty("name", out var name) ? name.GetString() : null
            ).Where(n => n != null).ToList();

            return Ok(roleNames);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching roles for user {id}");
            return StatusCode(500, new { message = "Failed to fetch user roles", error = ex.Message });
        }
    }

    // POST: api/keycloak/users/{id}/roles
    [HttpPost("{id}/roles")]
    public async Task<IActionResult> AssignRolesToUser(string id, [FromBody] List<string> roleNames)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                throw new InvalidOperationException("Oidc:Authority configuration is missing");
            }
            var realm = authority.Split("/").Last();
            
            // First, get all realm roles to find the role objects
            var rolesUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/roles";
            var rolesResponse = await client.GetAsync(rolesUrl);
            rolesResponse.EnsureSuccessStatusCode();
            
            var allRoles = await rolesResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
            var rolesToAssign = allRoles?.Where(r => 
                r.TryGetProperty("name", out var name) && name.GetString() != null && roleNames.Contains(name.GetString()!)
            ).ToList();

            if (rolesToAssign?.Count > 0)
            {
                var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/role-mappings/realm";
                var content = JsonContent.Create(rolesToAssign);
                var response = await client.PostAsync(url, content);
                response.EnsureSuccessStatusCode();
            }

            return Ok(new { message = "Roles assigned successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error assigning roles to user {id}");
            return StatusCode(500, new { message = "Failed to assign roles", error = ex.Message });
        }
    }

    // DELETE: api/keycloak/users/{id}/roles
    [HttpDelete("{id}/roles")]
    public async Task<IActionResult> RemoveRolesFromUser(string id, [FromBody] List<string> roleNames)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                throw new InvalidOperationException("Oidc:Authority configuration is missing");
            }
            var realm = authority.Split("/").Last();
            
            // Get all realm roles to find the role objects
            var rolesUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/roles";
            var rolesResponse = await client.GetAsync(rolesUrl);
            rolesResponse.EnsureSuccessStatusCode();
            
            var allRoles = await rolesResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
            var rolesToRemove = allRoles?.Where(r => 
                r.TryGetProperty("name", out var name) && name.GetString() != null && roleNames.Contains(name.GetString()!)
            ).ToList();

            if (rolesToRemove?.Count > 0)
            {
                var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/role-mappings/realm";
                var request = new HttpRequestMessage(HttpMethod.Delete, url)
                {
                    Content = JsonContent.Create(rolesToRemove)
                };
                var response = await client.SendAsync(request);
                response.EnsureSuccessStatusCode();
            }

            return Ok(new { message = "Roles removed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error removing roles from user {id}");
            return StatusCode(500, new { message = "Failed to remove roles", error = ex.Message });
        }
    }

    // GET: api/keycloak/users/{id}/groups
    [HttpGet("{id}/groups")]
    public async Task<IActionResult> GetUserGroups(string id)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/groups";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var groups = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            var groupNames = groups?.Select(g => 
                g.TryGetProperty("name", out var name) ? name.GetString() : null
            ).Where(n => n != null).ToList();

            return Ok(groupNames);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error fetching groups for user {id}");
            return StatusCode(500, new { message = "Failed to fetch user groups", error = ex.Message });
        }
    }

    // PUT: api/keycloak/users/{id}/groups/{groupId}
    [HttpPut("{id}/groups/{groupId}")]
    public async Task<IActionResult> AddUserToGroup(string id, string groupId)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/groups/{groupId}";

            var response = await client.PutAsync(url, null);
            response.EnsureSuccessStatusCode();

            return Ok(new { message = "User added to group successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error adding user {id} to group {groupId}");
            return StatusCode(500, new { message = "Failed to add user to group", error = ex.Message });
        }
    }

    // DELETE: api/keycloak/users/{id}/groups/{groupId}
    [HttpDelete("{id}/groups/{groupId}")]
    public async Task<IActionResult> RemoveUserFromGroup(string id, string groupId)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}/groups/{groupId}";

            var response = await client.DeleteAsync(url);
            response.EnsureSuccessStatusCode();

            return Ok(new { message = "User removed from group successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error removing user {id} from group {groupId}");
            return StatusCode(500, new { message = "Failed to remove user from group", error = ex.Message });
        }
    }

    // POST: api/keycloak/users/{id}/impersonate
    [HttpPost("{id}/impersonate")]
    public async Task<IActionResult> ImpersonateUser(string id)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            if (string.IsNullOrEmpty(authority))
            {
                return BadRequest(new { error = "Oidc:Authority configuration is missing" });
            }
            var realm = authority.Split("/").Last();
            var baseUrl = authority.Replace($"/realms/{realm}", "");
            
            // Call Keycloak's impersonation endpoint
            var url = $"{baseUrl}/admin/realms/{realm}/users/{id}/impersonation";
            
            var response = await client.PostAsync(url, null);
            response.EnsureSuccessStatusCode();

            // Get the impersonation response which contains cookies and redirect info
            var impersonationData = await response.Content.ReadFromJsonAsync<JsonElement>();
            
            // Build the impersonation URL - typically redirects to account console
            var impersonationUrl = $"{authority}/account";
            
            // If the response contains a specific redirect, use that
            if (impersonationData.TryGetProperty("redirect", out var redirectProp))
            {
                impersonationUrl = redirectProp.GetString() ?? impersonationUrl;
            }
            else if (impersonationData.TryGetProperty("sameRealm", out var sameRealmProp) && sameRealmProp.GetBoolean())
            {
                // For same-realm impersonation, build the URL with the account console
                impersonationUrl = $"{authority}/account";
            }

            return Ok(new { impersonationUrl });
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            _logger.LogError(ex, $"Forbidden: User does not have permission to impersonate user {id}");
            return StatusCode(403, new { message = "You do not have permission to impersonate users" });
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogError(ex, $"User {id} not found");
            return NotFound(new { message = "User not found" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error impersonating user {id}");
            return StatusCode(500, new { message = "Failed to impersonate user", error = ex.Message });
        }
    }

    private Dictionary<string, List<string>> BuildAttributes(Dictionary<string, List<string>>? existingAttributes, string? supervisorId)
    {
        var attributes = existingAttributes ?? new Dictionary<string, List<string>>();
        
        if (!string.IsNullOrEmpty(supervisorId))
        {
            attributes["supervisorId"] = new List<string> { supervisorId };
        }
        else
        {
            // Remove supervisorId if it was previously set but now empty
            attributes.Remove("supervisorId");
        }
        
        return attributes;
    }

    // POST: api/keycloak/users/workspace/{workspaceId}/{userId}/assign-zones
    [HttpPost("workspace/{workspaceId}/{userId}/assign-zones")]
    public async Task<IActionResult> AssignZonesToUser(int workspaceId, string userId, [FromBody] AssignZonesToUserDto dto)
    {
        try
        {
            var currentUserId = GetCurrentUserId();

            // Convert userId to int (system user ID)
            if (!int.TryParse(userId, out var systemUserId))
                return BadRequest(new { message = "Invalid user ID format" });

            // Remove existing assignments for this user
            var existingAssignments = await _context.UserZones
                .Where(uz => uz.UserId == systemUserId)
                .ToListAsync();
            _context.UserZones.RemoveRange(existingAssignments);

            // Add new assignments
            foreach (var zoneId in dto.ZoneIds)
            {
                // Verify zone exists
                var zoneExists = await _context.Zones
                    .AnyAsync(z => z.Id == zoneId && !z.IsDeleted);

                if (!zoneExists)
                {
                    return BadRequest(new { message = $"Zone with ID {zoneId} not found" });
                }

                var userZone = new UserZone
                {
                    UserId = systemUserId,
                    ZoneId = zoneId,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = currentUserId
                };
                _context.UserZones.Add(userZone);
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Zones assigned successfully", count = dto.ZoneIds.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error assigning zones to user {userId}");
            return StatusCode(500, new { message = "Failed to assign zones", error = ex.Message });
        }
    }

    // GET: api/keycloak/users/workspace/{workspaceId}/{userId}/zones
    [HttpGet("workspace/{workspaceId}/{userId}/zones")]
    public async Task<IActionResult> GetUserZones(int workspaceId, string userId)
    {
        try
        {
            if (!int.TryParse(userId, out var systemUserId))
                return BadRequest(new { message = "Invalid user ID format" });
                
            var zoneIds = await _context.UserZones
                .Where(uz => uz.UserId == systemUserId)
                .Select(uz => uz.ZoneId)
                .ToListAsync();

            return Ok(zoneIds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting zones for user {userId}");
            return StatusCode(500, new { message = "Failed to get user zones", error = ex.Message });
        }
    }
}
