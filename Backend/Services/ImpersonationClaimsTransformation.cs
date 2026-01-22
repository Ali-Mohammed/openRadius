using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Backend.Data;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

/// <summary>
/// Transforms claims when impersonation is active, making all backend APIs
/// automatically use the impersonated user's identity
/// </summary>
public class ImpersonationClaimsTransformation : IClaimsTransformation
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<ImpersonationClaimsTransformation> _logger;

    public ImpersonationClaimsTransformation(
        IHttpContextAccessor httpContextAccessor,
        MasterDbContext masterContext,
        ILogger<ImpersonationClaimsTransformation> logger)
    {
        _httpContextAccessor = httpContextAccessor;
        _masterContext = masterContext;
        _logger = logger;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        try
        {
            _logger.LogInformation("=== ClaimsTransformation.TransformAsync called ===");
            
            // Check if impersonation header is present
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext == null)
            {
                _logger.LogWarning("HttpContext is null in TransformAsync");
                return principal;
            }

            var impersonatedUserIdStr = httpContext.Request.Headers["X-Impersonated-User-Id"].FirstOrDefault();
            
            // If no impersonation, enrich the principal with system user ID for normal users
            if (string.IsNullOrEmpty(impersonatedUserIdStr) || !int.TryParse(impersonatedUserIdStr, out var impersonatedUserId))
            {
                _logger.LogInformation("No impersonation header, enriching with systemUserId");
                return await EnrichPrincipalWithSystemUserId(principal);
            }

        // Get the impersonated user from the master database
        var impersonatedUser = await _masterContext.Users
            .Where(u => u.Id == impersonatedUserId)
            .FirstOrDefaultAsync();

        if (impersonatedUser == null)
        {
            _logger.LogWarning("Impersonation failed: User ID {UserId} not found", impersonatedUserId);
            return principal;
        }

        // Get the original admin identity for auditing
        var originalIdentity = principal.Identity as ClaimsIdentity;
        if (originalIdentity == null)
            return principal;

        // Create a new identity with the impersonated user's claims
        var impersonatedIdentity = new ClaimsIdentity(originalIdentity.AuthenticationType);

        // Preserve original admin claims with a prefix for auditing
        foreach (var claim in originalIdentity.Claims)
        {
            impersonatedIdentity.AddClaim(new Claim($"original_{claim.Type}", claim.Value));
        }

        // Add impersonated user claims that will be used by all APIs
        impersonatedIdentity.AddClaim(new Claim(ClaimTypes.NameIdentifier, impersonatedUser.KeycloakUserId ?? ""));
        impersonatedIdentity.AddClaim(new Claim("sub", impersonatedUser.KeycloakUserId ?? ""));
        impersonatedIdentity.AddClaim(new Claim("UserKeycloakId", impersonatedUser.KeycloakUserId ?? ""));
        impersonatedIdentity.AddClaim(new Claim("systemUserId", impersonatedUserId.ToString()));
        impersonatedIdentity.AddClaim(new Claim(ClaimTypes.Email, impersonatedUser.Email ?? ""));
        impersonatedIdentity.AddClaim(new Claim("email", impersonatedUser.Email ?? ""));
        impersonatedIdentity.AddClaim(new Claim("preferred_username", impersonatedUser.Email?.Split('@')[0] ?? ""));
        impersonatedIdentity.AddClaim(new Claim(ClaimTypes.Name, $"{impersonatedUser.FirstName} {impersonatedUser.LastName}".Trim()));
        impersonatedIdentity.AddClaim(new Claim("name", $"{impersonatedUser.FirstName} {impersonatedUser.LastName}".Trim()));
        
        // Mark that this is an impersonation session
        impersonatedIdentity.AddClaim(new Claim("is_impersonating", "true"));
        impersonatedIdentity.AddClaim(new Claim("impersonated_user_id", impersonatedUserId.ToString()));

        _logger.LogInformation(
            "Claims transformed for impersonation: Admin {OriginalEmail} impersonating {ImpersonatedEmail}",
            originalIdentity.FindFirst("email")?.Value ?? "unknown",
            impersonatedUser.Email);

        return new ClaimsPrincipal(impersonatedIdentity);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in ClaimsTransformation.TransformAsync");
            return principal;
        }
    }

    /// <summary>
    /// Enriches the principal with system user ID for non-impersonation scenarios
    /// </summary>
    private async Task<ClaimsPrincipal> EnrichPrincipalWithSystemUserId(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        if (identity == null)
        {
            _logger.LogWarning("Identity is null in EnrichPrincipalWithSystemUserId");
            return principal;
        }

        // Check if claims are already enriched
        if (identity.FindFirst("systemUserId") != null)
        {
            _logger.LogDebug("systemUserId claim already exists");
            return principal;
        }

        // Get Keycloak user ID from token (sub claim is REQUIRED)
        var keycloakUserId = identity.FindFirst("sub")?.Value 
            ?? identity.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value
            ?? identity.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(keycloakUserId))
        {
            _logger.LogError("❌ CRITICAL: 'sub' claim is missing from JWT token. Keycloak configuration is incorrect!");
            _logger.LogError("Please add 'sub' claim mapper to Keycloak: Client scopes → openid → Mappers → Create 'sub' mapper");
            throw new UnauthorizedAccessException("Missing required 'sub' claim in token. Please check Keycloak configuration.");
        }

        // Extract additional user claims
        var email = identity.FindFirst("email")?.Value ?? identity.FindFirst(ClaimTypes.Email)?.Value;
        var firstName = identity.FindFirst("given_name")?.Value ?? identity.FindFirst(ClaimTypes.GivenName)?.Value ?? "";
        var lastName = identity.FindFirst("family_name")?.Value ?? identity.FindFirst(ClaimTypes.Surname)?.Value ?? "";
        var preferredUsername = identity.FindFirst("preferred_username")?.Value;
        
        _logger.LogInformation("✓ EnrichPrincipalWithSystemUserId - KeycloakId={KeycloakId}, Email={Email}, Username={Username}", 
            keycloakUserId, email, preferredUsername);

        // Look up system user by Keycloak UUID (PRIMARY and ONLY lookup method)
        var systemUser = await _masterContext.Users
            .Where(u => u.KeycloakUserId == keycloakUserId)
            .FirstOrDefaultAsync();
        
        if (systemUser != null)
        {
            _logger.LogInformation("✓ User found by KeycloakId: User ID {UserId}, Email {Email}", systemUser.Id, systemUser.Email);
        }

        // Auto-create user if doesn't exist
        if (systemUser == null)
        {
            if (string.IsNullOrEmpty(email))
            {
                _logger.LogError("Cannot auto-create user without email address");
                throw new UnauthorizedAccessException("Missing required 'email' claim for user creation.");
            }
            
            // Check if a user with this email exists (for migration/upgrade scenarios)
            var existingUserByEmail = await _masterContext.Users
                .Where(u => u.Email == email)
                .FirstOrDefaultAsync();
            
            if (existingUserByEmail != null)
            {
                _logger.LogWarning("⚠️ User exists with email {Email} but different KeycloakUserId. Updating KeycloakUserId from {OldId} to {NewId}", 
                    email, existingUserByEmail.KeycloakUserId ?? "NULL", keycloakUserId);
                
                existingUserByEmail.KeycloakUserId = keycloakUserId;
                await _masterContext.SaveChangesAsync();
                systemUser = existingUserByEmail;
            }
            else
            {
                _logger.LogInformation("🆕 Creating new user: KeycloakId={KeycloakId}, Email={Email}, Name={FirstName} {LastName}", 
                    keycloakUserId, email, firstName, lastName);
                
                systemUser = new Models.User
                {
                    KeycloakUserId = keycloakUserId,
                    Email = email,
                    FirstName = firstName,
                    LastName = lastName,
                    CreatedAt = DateTime.UtcNow
                };
                
                _masterContext.Users.Add(systemUser);
                await _masterContext.SaveChangesAsync();
                
                _logger.LogInformation("✓ Auto-created user: ID={UserId}, Email={Email}, KeycloakId={KeycloakId}", 
                    systemUser.Id, systemUser.Email, keycloakUserId);
            }
        }

        // Add system user ID and Keycloak ID claims
        identity.AddClaim(new Claim("systemUserId", systemUser.Id.ToString()));
        identity.AddClaim(new Claim("UserKeycloakId", keycloakUserId));

        _logger.LogInformation(
            "✅ Enriched claims successfully: SystemUserId={SystemUserId}, Email={Email}, KeycloakId={KeycloakId}",
            systemUser.Id, systemUser.Email, keycloakUserId);

        return principal;
    }
}
