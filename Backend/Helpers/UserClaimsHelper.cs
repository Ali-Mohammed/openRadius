using System.Security.Claims;
using Backend.Models;

namespace Backend.Helpers;

/// <summary>
/// Helper class to easily access user claims from ClaimsPrincipal
/// </summary>
public static class UserClaimsHelper
{
    /// <summary>
    /// Gets the system user ID (internal database ID) from claims
    /// </summary>
    public static int? GetSystemUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst("systemUserId")?.Value;
        return int.TryParse(value, out var userId) ? userId : null;
    }

    /// <summary>
    /// Gets the Keycloak user ID from claims
    /// </summary>
    public static string? GetUserKeycloakId(this ClaimsPrincipal user)
    {
        return user.FindFirst("UserKeycloakId")?.Value 
               ?? user.FindFirst("sub")?.Value;
    }

    /// <summary>
    /// Gets the user email from claims
    /// </summary>
    public static string? GetUserEmail(this ClaimsPrincipal user)
    {
        return user.FindFirst("email")?.Value 
               ?? user.FindFirst(ClaimTypes.Email)?.Value;
    }

    /// <summary>
    /// Gets the user's full name from claims
    /// </summary>
    public static string? GetUserName(this ClaimsPrincipal user)
    {
        return user.FindFirst("name")?.Value 
               ?? user.FindFirst(ClaimTypes.Name)?.Value;
    }

    /// <summary>
    /// Gets the preferred username from claims
    /// </summary>
    public static string? GetPreferredUsername(this ClaimsPrincipal user)
    {
        return user.FindFirst("preferred_username")?.Value;
    }

    /// <summary>
    /// Checks if the current user is impersonating another user
    /// </summary>
    public static bool IsImpersonating(this ClaimsPrincipal user)
    {
        return user.FindFirst("is_impersonating")?.Value == "true";
    }

    /// <summary>
    /// Gets the impersonated user ID if the current user is impersonating
    /// </summary>
    public static int? GetImpersonatedUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst("impersonated_user_id")?.Value;
        return int.TryParse(value, out var userId) ? userId : null;
    }

    /// <summary>
    /// Gets the original admin's Keycloak ID when impersonating
    /// </summary>
    public static string? GetOriginalAdminKeycloakId(this ClaimsPrincipal user)
    {
        return user.FindFirst("original_sub")?.Value;
    }

    /// <summary>
    /// Gets the original admin's email when impersonating
    /// </summary>
    public static string? GetOriginalAdminEmail(this ClaimsPrincipal user)
    {
        return user.FindFirst("original_email")?.Value;
    }

    /// <summary>
    /// Checks if the user has a specific role, checking both IsInRole and JWT claims
    /// This handles Keycloak's realm_access role structure
    /// </summary>
    public static bool HasRole(this ClaimsPrincipal user, string roleName)
    {
        if (string.IsNullOrWhiteSpace(roleName))
            return false;

        // Check standard ASP.NET IsInRole
        if (user.IsInRole(roleName))
            return true;

        // Check case-insensitive variant
        var roleNameLower = roleName.ToLower();
        if (user.IsInRole(roleNameLower))
            return true;

        // Check in claims with different claim types (handles Keycloak JWT structure)
        return user.Claims.Any(c => 
            (c.Type == "role" || c.Type == ClaimTypes.Role) && 
            (c.Value.Equals(roleName, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>
    /// Checks if the user has any of the specified roles
    /// </summary>
    public static bool HasAnyRole(this ClaimsPrincipal user, params string[] roles)
    {
        return roles.Any(role => user.HasRole(role));
    }

    /// <summary>
    /// Checks if the user has all of the specified roles
    /// </summary>
    public static bool HasAllRoles(this ClaimsPrincipal user, params string[] roles)
    {
        return roles.All(role => user.HasRole(role));
    }

    /// <summary>
    /// Checks if the user is an administrator (has admin role)
    /// </summary>
    public static bool IsAdmin(this ClaimsPrincipal user)
    {
        // Log all claims for debugging
        Console.WriteLine("[IsAdmin Check] All claims:");
        foreach (var claim in user.Claims)
        {
            Console.WriteLine($"  Type: {claim.Type}, Value: {claim.Value}");
        }
        
        // Log role claims specifically
        var roles = user.Claims
            .Where(c => c.Type == "role" || c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .ToList();
        Console.WriteLine($"[IsAdmin Check] Found {roles.Count} role claims: {string.Join(", ", roles)}");
        
        return user.HasRole(UserRoles.Admin);
    }

    /// <summary>
    /// Checks if the user has any administrative role (admin or manager)
    /// </summary>
    public static bool IsAdministrative(this ClaimsPrincipal user)
    {
        return user.HasAnyRole(UserRoles.AdministrativeRoles);
    }
}
