using System.Security.Claims;

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
}
