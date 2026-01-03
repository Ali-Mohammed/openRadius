using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Backend.Models;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UserManagementController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<UserManagementController> _logger;
    private string? _adminToken;
    private DateTime _tokenExpiry = DateTime.MinValue;

    public UserManagementController(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<UserManagementController> logger)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
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
            new KeyValuePair<string, string>("client_id", _configuration["Oidc:ClientId"] ?? ""),
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
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users{queryString}";

            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var users = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            
            var userResponses = users?.Select(u => new KeycloakUserResponse
            {
                Id = u.TryGetProperty("id", out var id) ? id.GetString() : null,
                Username = u.TryGetProperty("username", out var username) ? username.GetString() : null,
                Email = u.TryGetProperty("email", out var email) ? email.GetString() : null,
                FirstName = u.TryGetProperty("firstName", out var firstName) ? firstName.GetString() : null,
                LastName = u.TryGetProperty("lastName", out var lastName) ? lastName.GetString() : null,
                Enabled = u.TryGetProperty("enabled", out var enabled) && enabled.GetBoolean(),
                EmailVerified = u.TryGetProperty("emailVerified", out var emailVerified) && emailVerified.GetBoolean(),
                CreatedTimestamp = u.TryGetProperty("createdTimestamp", out var createdTimestamp) ? createdTimestamp.GetInt64() : null
            }).ToList();

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
            var realm = authority?.Split("/").Last();
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
                Enabled = user.TryGetProperty("enabled", out var enabled) && enabled.GetBoolean(),
                EmailVerified = user.TryGetProperty("emailVerified", out var emailVerified) && emailVerified.GetBoolean(),
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
            var realm = authority?.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users";

            var userPayload = new
            {
                username = request.Username,
                email = request.Email,
                firstName = request.FirstName,
                lastName = request.LastName,
                enabled = request.Enabled,
                emailVerified = request.EmailVerified,
                attributes = request.Attributes,
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
            var realm = authority?.Split("/").Last();
            var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{id}";

            var userPayload = new
            {
                username = request.Username,
                email = request.Email,
                firstName = request.FirstName,
                lastName = request.LastName,
                enabled = request.Enabled,
                emailVerified = request.EmailVerified,
                attributes = request.Attributes
            };

            var content = new StringContent(JsonSerializer.Serialize(userPayload), Encoding.UTF8, "application/json");
            var response = await client.PutAsync(url, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { message = "Failed to update user", error = errorContent });
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
            var realm = authority?.Split("/").Last();
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
            var realm = authority?.Split("/").Last();
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

    // GET: api/users/groups
    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups()
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            var realm = authority?.Split("/").Last();
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

    private async Task AddUserToGroup(string userId, string groupName)
    {
        try
        {
            var client = await GetAuthenticatedClient();
            var authority = _configuration["Oidc:Authority"];
            var realm = authority?.Split("/").Last();
            
            // First, get all groups to find the group ID
            var groupsUrl = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/groups";
            var groupsResponse = await client.GetAsync(groupsUrl);
            groupsResponse.EnsureSuccessStatusCode();
            
            var groups = await groupsResponse.Content.ReadFromJsonAsync<List<JsonElement>>();
            var group = groups?.FirstOrDefault(g => 
                g.TryGetProperty("name", out var name) && name.GetString() == groupName);
            
            if (group.HasValue && group.Value.TryGetProperty("id", out var groupId))
            {
                var url = $"{authority.Replace($"/realms/{realm}", "")}/admin/realms/{realm}/users/{userId}/groups/{groupId.GetString()}";
                await client.PutAsync(url, null);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error adding user to group {groupName}");
        }
    }
}
