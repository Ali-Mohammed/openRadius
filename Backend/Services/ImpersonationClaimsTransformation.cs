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
        // Check if impersonation header is present
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
            return principal;

        var impersonatedUserIdStr = httpContext.Request.Headers["X-Impersonated-User-Id"].FirstOrDefault();
        
        // If no impersonation, enrich the principal with system user ID for normal users
        if (string.IsNullOrEmpty(impersonatedUserIdStr) || !int.TryParse(impersonatedUserIdStr, out var impersonatedUserId))
        {
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

    /// <summary>
    /// Enriches the principal with system user ID for non-impersonation scenarios
    /// </summary>
    private async Task<ClaimsPrincipal> EnrichPrincipalWithSystemUserId(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        if (identity == null)
            return principal;

        // Check if claims are already enriched
        if (identity.FindFirst("systemUserId") != null)
            return principal;

        // Get Keycloak user ID from token
        var keycloakUserId = identity.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(keycloakUserId))
            return principal;

        // Look up system user by Keycloak ID
        var systemUser = await _masterContext.Users
            .Where(u => u.KeycloakUserId == keycloakUserId)
            .FirstOrDefaultAsync();

        if (systemUser == null)
        {
            _logger.LogWarning("System user not found for Keycloak ID: {KeycloakId}", keycloakUserId);
            return principal;
        }

        // Add system user ID and Keycloak ID claims
        identity.AddClaim(new Claim("systemUserId", systemUser.Id.ToString()));
        identity.AddClaim(new Claim("UserKeycloakId", keycloakUserId));

        _logger.LogDebug(
            "Enriched claims for user: SystemUserId={SystemUserId}, KeycloakId={KeycloakId}",
            systemUser.Id, keycloakUserId);

        return principal;
    }
}
