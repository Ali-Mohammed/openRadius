using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;
using System.Net.Http.Headers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ApplicationDbContext _appContext;
    private readonly ILogger<UsersController> _logger;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public UsersController(
        MasterDbContext context,
        ApplicationDbContext appContext,
        ILogger<UsersController> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _appContext = appContext;
        _logger = logger;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetUsers()
    {
        var users = await _context.Users
            .Include(u => u.Supervisor)
            .ToListAsync();

        // Get radius user counts per user via their assigned zones
        var userZones = await _appContext.UserZones
            .Select(uz => new { uz.UserId, uz.ZoneId })
            .ToListAsync();

        var zoneIds = userZones.Select(uz => uz.ZoneId).Distinct().ToList();

        var radiusUserCountsByZone = await _appContext.RadiusUsers
            .Where(r => !r.IsDeleted && r.ZoneId.HasValue && zoneIds.Contains(r.ZoneId.Value))
            .GroupBy(r => r.ZoneId!.Value)
            .Select(g => new { ZoneId = g.Key, Count = g.Count() })
            .ToListAsync();

        var radiusCountByZone = radiusUserCountsByZone.ToDictionary(x => x.ZoneId, x => x.Count);

        // Build a lookup: userId -> total radius users across all their zones
        var radiusUserCountByUser = userZones
            .GroupBy(uz => uz.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.Sum(uz => radiusCountByZone.GetValueOrDefault(uz.ZoneId, 0))
            );

        var response = users.Select(u => new
        {
            u.Id,
            u.Email,
            u.FirstName,
            u.LastName,
            u.CreatedAt,
            u.KeycloakUserId,
            u.SupervisorId,
            Supervisor = u.SupervisorId.HasValue ? new
            {
                Id = u.Supervisor!.Id,
                FirstName = u.Supervisor.FirstName,
                LastName = u.Supervisor.LastName,
                Email = u.Supervisor.Email
            } : null,
            RadiusUserCount = radiusUserCountByUser.GetValueOrDefault(u.Id, 0)
        });
        
        return Ok(response);
    }

    [HttpGet("me")]
    public async Task<ActionResult<object>> GetCurrentUser()
    {
        // Check if user is impersonating (UI-only impersonation)
        var impersonatedUserIdHeader = Request.Headers["X-Impersonated-User-Id"].FirstOrDefault();
        if (!string.IsNullOrEmpty(impersonatedUserIdHeader) && int.TryParse(impersonatedUserIdHeader, out var impersonatedUserId))
        {
            _logger.LogInformation("Returning impersonated user data for user ID {UserId}", impersonatedUserId);
            
            // Get the impersonated user from database
            var impersonatedUser = await _context.Users
                .Include(u => u.DefaultWorkspace)
                .Include(u => u.CurrentWorkspace)
                .FirstOrDefaultAsync(u => u.Id == impersonatedUserId);

            if (impersonatedUser != null)
            {
                // Return impersonated user's data with minimal claims
                // Note: Roles and groups will be from the admin token, not the impersonated user
                // This is a limitation of UI-only impersonation
                return Ok(new { 
                    IsAuthenticated = true,
                    Name = $"{impersonatedUser.FirstName} {impersonatedUser.LastName}",
                    Email = impersonatedUser.Email,
                    Roles = new List<string>(), // No roles for UI-only impersonation
                    ResourceRoles = new Dictionary<string, List<string>>(),
                    Groups = new List<string>(),
                    Claims = new List<object>(),
                    User = new {
                        impersonatedUser.Id,
                        impersonatedUser.Email,
                        impersonatedUser.FirstName,
                        impersonatedUser.LastName,
                        impersonatedUser.CurrentWorkspaceId,
                        impersonatedUser.DefaultWorkspaceId,
                        CurrentWorkspace = impersonatedUser.CurrentWorkspace != null ? new {
                            impersonatedUser.CurrentWorkspace.Id,
                            impersonatedUser.CurrentWorkspace.Title,
                            impersonatedUser.CurrentWorkspace.Name,
                            impersonatedUser.CurrentWorkspace.Location,
                            impersonatedUser.CurrentWorkspace.Color
                        } : null,
                        DefaultWorkspace = impersonatedUser.DefaultWorkspace != null ? new {
                            impersonatedUser.DefaultWorkspace.Id,
                            impersonatedUser.DefaultWorkspace.Title,
                            impersonatedUser.DefaultWorkspace.Name,
                            impersonatedUser.DefaultWorkspace.Location,
                            impersonatedUser.DefaultWorkspace.Color
                        } : null
                    }
                });
            }
        }

        // Normal flow - return current user's data from token
        var claims = User.Claims.Select(c => new { c.Type, c.Value });
        
        // Extract name
        var name = User.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
        
        // Extract email
        var email = User.Claims.FirstOrDefault(c => 
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
            c.Type == "email")?.Value;
        
        // Get user from database to include workspace information
        User? dbUser = null;
        if (!string.IsNullOrEmpty(email))
        {
            dbUser = await _context.Users
                .Include(u => u.DefaultWorkspace)
                .Include(u => u.CurrentWorkspace)
                .FirstOrDefaultAsync(u => u.Email == email);
            
            // Auto-create user if doesn't exist
            if (dbUser == null)
            {
                var keycloakUserId = User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
                if (!string.IsNullOrEmpty(keycloakUserId))
                {
                    var firstName = User.Claims.FirstOrDefault(c => c.Type == "given_name")?.Value ?? "";
                    var lastName = User.Claims.FirstOrDefault(c => c.Type == "family_name")?.Value ?? "";
                    
                    dbUser = new User
                    {
                        KeycloakUserId = keycloakUserId,
                        Email = email,
                        FirstName = firstName,
                        LastName = lastName,
                        CreatedAt = DateTime.UtcNow
                    };
                    
                    _context.Users.Add(dbUser);
                    await _context.SaveChangesAsync();
                    
                    _logger.LogInformation("Auto-created user on first login: Email={Email}, SystemId={SystemId}", email, dbUser.Id);
                }
            }
        }
        
        // Extract realm roles from JSON
        var realmRoles = new List<string>();
        var realmAccessClaim = User.Claims.FirstOrDefault(c => c.Type == "realm_access");
        if (realmAccessClaim != null)
        {
            try
            {
                var realmAccess = JsonSerializer.Deserialize<JsonElement>(realmAccessClaim.Value);
                if (realmAccess.TryGetProperty("roles", out var rolesElement))
                {
                    realmRoles = rolesElement.EnumerateArray()
                        .Select(r => r.GetString() ?? "")
                        .Where(r => !string.IsNullOrEmpty(r))
                        .ToList();
                }
            }
            catch { }
        }
        
        // Extract resource roles from JSON
        var resourceRoles = new Dictionary<string, List<string>>();
        var resourceAccessClaim = User.Claims.FirstOrDefault(c => c.Type == "resource_access");
        if (resourceAccessClaim != null)
        {
            try
            {
                var resourceAccess = JsonSerializer.Deserialize<JsonElement>(resourceAccessClaim.Value);
                foreach (var resource in resourceAccess.EnumerateObject())
                {
                    if (resource.Value.TryGetProperty("roles", out var rolesElement))
                    {
                        resourceRoles[resource.Name] = rolesElement.EnumerateArray()
                            .Select(r => r.GetString() ?? "")
                            .Where(r => !string.IsNullOrEmpty(r))
                            .ToList();
                    }
                }
            }
            catch { }
        }
        
        // Extract groups
        var groups = User.Claims
            .Where(c => c.Type == "groups" || c.Type.EndsWith("/groups"))
            .Select(c => c.Value)
            .ToList();

        return Ok(new { 
            IsAuthenticated = User.Identity?.IsAuthenticated ?? false,
            Name = name,
            Email = email,
            Roles = realmRoles,
            ResourceRoles = resourceRoles,
            Groups = groups,
            Claims = claims,
            User = dbUser != null ? new {
                dbUser.Id,
                dbUser.Email,
                dbUser.FirstName,
                dbUser.LastName,
                dbUser.CurrentWorkspaceId,
                dbUser.DefaultWorkspaceId,
                CurrentWorkspace = dbUser.CurrentWorkspace != null ? new {
                    dbUser.CurrentWorkspace.Id,
                    dbUser.CurrentWorkspace.Title,
                    dbUser.CurrentWorkspace.Name,
                    dbUser.CurrentWorkspace.Location,
                    dbUser.CurrentWorkspace.Color
                } : null,
                DefaultWorkspace = dbUser.DefaultWorkspace != null ? new {
                    dbUser.DefaultWorkspace.Id,
                    dbUser.DefaultWorkspace.Title,
                    dbUser.DefaultWorkspace.Name,
                    dbUser.DefaultWorkspace.Location,
                    dbUser.DefaultWorkspace.Color
                } : null
            } : null
        });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateCurrentUser([FromBody] UpdateProfileDto profileDto)
    {
        // Try different email claim types
        var email = User.Claims.FirstOrDefault(c => c.Type == "email" || 
                                                     c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
                                                     c.Type.EndsWith("/emailaddress"))?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            return BadRequest(new { 
                message = "Email not found in token",
                availableClaims = User.Claims.Select(c => new { c.Type, c.Value }).ToList()
            });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        
        if (user == null)
        {
            // Create new user if doesn't exist
            user = new User
            {
                Email = email,
                FirstName = profileDto.FirstName,
                LastName = profileDto.LastName,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(user);
        }
        else
        {
            // Update existing user
            user.FirstName = profileDto.FirstName;
            user.LastName = profileDto.LastName;
        }

        await _context.SaveChangesAsync();
        
        // Project to DTO to avoid circular reference
        var response = new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.CreatedAt,
            user.KeycloakUserId,
            user.SupervisorId
        };
        
        return Ok(response);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetUser(int id)
    {
        var user = await _context.Users
            .Include(u => u.Supervisor)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        var response = new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.CreatedAt,
            user.KeycloakUserId,
            user.SupervisorId,
            Supervisor = user.SupervisorId.HasValue ? new
            {
                Id = user.Supervisor!.Id,
                FirstName = user.Supervisor.FirstName,
                LastName = user.Supervisor.LastName,
                Email = user.Supervisor.Email
            } : null
        };

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<User>> CreateUser(User user)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, User user)
    {
        if (id != user.Id)
        {
            return BadRequest();
        }

        _context.Entry(user).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!UserExists(id))
            {
                return NotFound();
            }
            throw;
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
        {
            return NotFound();
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("me/workspace/{workspaceId}")]
    public async Task<IActionResult> SetUserWorkspace(int workspaceId, [FromQuery] bool setAsDefault = true)
    {
        var email = User.Claims.FirstOrDefault(c => c.Type == "email" || 
                                                     c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
                                                     c.Type.EndsWith("/emailaddress"))?.Value;
        
        if (string.IsNullOrEmpty(email))
        {
            return BadRequest(new { message = "Email not found in token" });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        
        if (user == null)
        {
            // Create new user if doesn't exist
            var name = User.Claims.FirstOrDefault(c => c.Type == "name")?.Value;
            var nameParts = name?.Split(' ', 2) ?? new[] { "", "" };
            
            user = new User
            {
                Email = email,
                FirstName = nameParts.Length > 0 ? nameParts[0] : "",
                LastName = nameParts.Length > 1 ? nameParts[1] : "",
                CreatedAt = DateTime.UtcNow,
                CurrentWorkspaceId = workspaceId,
                DefaultWorkspaceId = setAsDefault ? workspaceId : null
            };
            _context.Users.Add(user);
        }
        else
        {
            // Set current workspace
            user.CurrentWorkspaceId = workspaceId;
            
            // Optionally set as default workspace
            if (setAsDefault)
            {
                user.DefaultWorkspaceId = workspaceId;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Workspace updated successfully", user });
    }

    [HttpPost("impersonate/{userId}")]
    public async Task<ActionResult<object>> ImpersonateUser(int userId)
    {
        // Extract realm roles from JSON
        var realmRoles = new List<string>();
        var realmAccessClaim = User.Claims.FirstOrDefault(c => c.Type == "realm_access");
        if (realmAccessClaim != null)
        {
            try
            {
                var realmAccess = JsonSerializer.Deserialize<JsonElement>(realmAccessClaim.Value);
                if (realmAccess.TryGetProperty("roles", out var rolesElement))
                {
                    realmRoles = rolesElement.EnumerateArray()
                        .Select(r => r.GetString() ?? "")
                        .Where(r => !string.IsNullOrEmpty(r))
                        .ToList();
                }
            }
            catch { }
        }

        // Check if user has admin role (support multiple variants)
        var hasAdminRole = realmRoles.Any(role => 
            role.Equals("admin", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("administrator", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("Super Administrator", StringComparison.OrdinalIgnoreCase) ||
            role.Equals("super-administrator", StringComparison.OrdinalIgnoreCase)
        );

        if (!hasAdminRole)
        {
            return Forbid();
        }

        // Get the user to impersonate
        var targetUser = await _context.Users
            .Include(u => u.DefaultWorkspace)
            .Include(u => u.CurrentWorkspace)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (targetUser == null)
        {
            return NotFound(new { message = "User not found" });
        }

        if (string.IsNullOrEmpty(targetUser.KeycloakUserId))
        {
            return BadRequest(new { message = "User does not have a Keycloak account" });
        }

        // Get current user's email for audit
        var adminEmail = User.Claims.FirstOrDefault(c => 
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
            c.Type == "email")?.Value;

        // Get current admin's token to store it
        var currentToken = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");

        try
        {
            // Note: Keycloak 26.5.0 has limitations with token exchange
            // We cannot get a real impersonated token, so we use UI-only impersonation
            // The frontend will use the admin's token but display impersonated user's data
            _logger.LogWarning(
                "User impersonation (UI-only): {AdminEmail} is impersonating user {TargetEmail} (ID: {TargetId})",
                adminEmail,
                targetUser.Email,
                targetUser.Id
            );

            // Return the admin's current token (not a new token)
            // This maintains the admin's session while the UI shows the impersonated user
            return Ok(new
            {
                success = true,
                token = currentToken, // Use admin's token (UI-only impersonation)
                originalToken = currentToken, // Same as token since we can't get impersonated token
                impersonatedUser = new
                {
                    targetUser.Id,
                    targetUser.Email,
                    targetUser.FirstName,
                    targetUser.LastName,
                    targetUser.CurrentWorkspaceId,
                    targetUser.DefaultWorkspaceId,
                    CurrentWorkspace = targetUser.CurrentWorkspace != null ? new
                    {
                        targetUser.CurrentWorkspace.Id,
                        targetUser.CurrentWorkspace.Title,
                        targetUser.CurrentWorkspace.Name,
                        targetUser.CurrentWorkspace.Location,
                        targetUser.CurrentWorkspace.Color
                    } : null,
                    DefaultWorkspace = targetUser.DefaultWorkspace != null ? new
                    {
                        targetUser.DefaultWorkspace.Id,
                        targetUser.DefaultWorkspace.Title,
                        targetUser.DefaultWorkspace.Name,
                        targetUser.DefaultWorkspace.Location,
                        targetUser.DefaultWorkspace.Color
                    } : null
                },
                originalAdmin = adminEmail
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to impersonate user {UserId}", userId);
            return StatusCode(500, new { message = "Failed to impersonate user", error = ex.Message });
        }
    }

    [HttpPost("exit-impersonation")]
    public ActionResult<object> ExitImpersonation()
    {
        // Get current user's email
        var email = User.Claims.FirstOrDefault(c => 
            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
            c.Type == "email")?.Value;

        _logger.LogInformation(
            "User {Email} exited impersonation mode",
            email
        );

        return Ok(new { success = true, message = "Exited impersonation mode" });
    }

    private async Task<string?> GetImpersonatedTokenAsync(string targetKeycloakUserId)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var authority = _configuration["Oidc:Authority"];
            
            if (string.IsNullOrEmpty(authority))
            {
                _logger.LogError("Oidc:Authority configuration is missing");
                return null;
            }

            var realm = authority.Split("/").Last();
            var clientId = _configuration["KeycloakAdmin:ClientId"];
            var clientSecret = _configuration["KeycloakAdmin:ClientSecret"];

            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            {
                _logger.LogError("KeycloakAdmin credentials are missing");
                return null;
            }

            _logger.LogInformation("Getting impersonated token for user {UserId} using token exchange", targetKeycloakUserId);

            // Use OAuth2 Token Exchange (RFC 8693) to get impersonated user's token
            // This is the proper way to impersonate in Keycloak
            var tokenUrl = $"{authority}/protocol/openid-connect/token";
            
            // First get admin token
            var adminTokenContent = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "client_credentials"),
                new KeyValuePair<string, string>("client_id", clientId),
                new KeyValuePair<string, string>("client_secret", clientSecret)
            });

            var adminTokenResponse = await client.PostAsync(tokenUrl, adminTokenContent);
            if (!adminTokenResponse.IsSuccessStatusCode)
            {
                var error = await adminTokenResponse.Content.ReadAsStringAsync();
                _logger.LogError("Failed to get admin token: {StatusCode}, Error: {Error}", adminTokenResponse.StatusCode, error);
                return null;
            }

            var adminTokenResult = await adminTokenResponse.Content.ReadFromJsonAsync<JsonElement>();
            var adminToken = adminTokenResult.GetProperty("access_token").GetString();

            if (string.IsNullOrEmpty(adminToken))
            {
                _logger.LogError("Received empty admin token from Keycloak");
                return null;
            }

            _logger.LogInformation("Successfully got admin token, performing token exchange");

            // Get user details from Keycloak to get the username
            var keycloakBaseUrl = authority.Replace($"/realms/{realm}", "");
            var userDetailUrl = $"{keycloakBaseUrl}/admin/realms/{realm}/users/{targetKeycloakUserId}";
            
            var userDetailRequest = new HttpRequestMessage(HttpMethod.Get, userDetailUrl);
            userDetailRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);
            
            var userDetailResponse = await client.SendAsync(userDetailRequest);
            if (!userDetailResponse.IsSuccessStatusCode)
            {
                var error = await userDetailResponse.Content.ReadAsStringAsync();
                _logger.LogError("Failed to get user details: {StatusCode}, Error: {Error}", userDetailResponse.StatusCode, error);
                return null;
            }

            var userDetail = await userDetailResponse.Content.ReadFromJsonAsync<JsonElement>();
            var username = userDetail.GetProperty("username").GetString();

            if (string.IsNullOrEmpty(username))
            {
                _logger.LogError("Could not get username for user {UserId}", targetKeycloakUserId);
                return null;
            }

            _logger.LogInformation("Found username {Username} for user {UserId}, getting direct grant token", username, targetKeycloakUserId);

            // Keycloak 26.5.0 doesn't support requested_subject in token exchange
            // Instead, we'll use the impersonation cookie approach - get a session token
            // by calling the impersonation endpoint which creates a session
            var impersonateUrl = $"{keycloakBaseUrl}/admin/realms/{realm}/users/{targetKeycloakUserId}/impersonation";
            var impersonateRequest = new HttpRequestMessage(HttpMethod.Post, impersonateUrl);
            impersonateRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);
            
            var impersonateResponse = await client.SendAsync(impersonateRequest);
            
            if (!impersonateResponse.IsSuccessStatusCode)
            {
                var error = await impersonateResponse.Content.ReadAsStringAsync();
                _logger.LogError("Impersonation endpoint failed: {StatusCode}, Error: {Error}", impersonateResponse.StatusCode, error);
                return null;
            }

            var impersonateResult = await impersonateResponse.Content.ReadFromJsonAsync<JsonElement>();
            
            // The impersonation endpoint returns a redirect URL with a code
            // We need to extract the session code from the redirect
            if (impersonateResult.TryGetProperty("redirect", out var redirectElement))
            {
                var redirectUrl = redirectElement.GetString();
                _logger.LogInformation("Got impersonation redirect: {Redirect}", redirectUrl);
                
                // The redirect contains a session but we can't easily get a token from it
                // Alternative: Use password grant if we had the password, but we don't
                // Best solution for now: Return admin token and just change the UI
                // This is a limitation of Keycloak's token exchange in version 26.5
                _logger.LogWarning("Keycloak 26.5.0 token exchange limitation - using UI-only impersonation");
                
                // For now, return the admin token - the frontend will show impersonated user
                // but backend operations will use admin permissions
                return adminToken;
            }

            _logger.LogError("Impersonation response did not contain redirect URL");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while getting impersonated token for user {UserId}", targetKeycloakUserId);
            return null;
        }
    }

    private bool UserExists(int id)
    {
        return _context.Users.Any(e => e.Id == id);
    }
}

public record UpdateProfileDto(string FirstName, string LastName);


