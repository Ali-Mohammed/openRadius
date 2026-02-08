using System.Text.RegularExpressions;
using Backend.Data;
using Backend.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Backend.Configuration;

/// <summary>
/// ASP.NET Core middleware that enforces granular permissions on every API endpoint
/// based on the centralized <see cref="PermissionRouteMap"/>.
///
/// Pipeline position: AFTER UseAuthentication() and AFTER UseAuthorization().
///
/// Flow:
///  1. Non-API requests pass through immediately.
///  2. Endpoints marked [AllowAnonymous] pass through.
///  3. Unauthenticated users on protected routes → 401.
///  4. Super-admin / Keycloak admin roles → pass through (bypass).
///  5. Matched route with null permission → pass (auth-only).
///  6. Matched route with permission → DB lookup → 403 if missing.
///  7. Unmatched route on authenticated user → pass (no restriction).
///
/// This gives comprehensive "deny by default" for every mapped route
/// without needing to touch individual controller files.
/// </summary>
public class PermissionAuthorizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<PermissionAuthorizationMiddleware> _logger;
    private readonly List<CompiledRouteEntry> _compiledRoutes;

    public PermissionAuthorizationMiddleware(
        RequestDelegate next,
        ILogger<PermissionAuthorizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;

        // Pre-compile all route patterns into Regexes at startup
        _compiledRoutes = PermissionRouteMap.GetMappings()
            .Select(e => new CompiledRouteEntry(
                e.HttpMethod,
                CompilePattern(e.RoutePattern),
                e.RoutePattern,
                e.Permission))
            .ToList();

        _logger.LogInformation(
            "PermissionAuthorizationMiddleware initialized with {Count} route-permission mappings",
            _compiledRoutes.Count);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.TrimStart('/').TrimEnd('/');
        var method = context.Request.Method;

        // ── Skip non-API requests ───────────────────────────────────
        if (string.IsNullOrEmpty(path) || !path.StartsWith("api/", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // ── Skip if endpoint has [AllowAnonymous] ───────────────────
        var endpoint = context.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<IAllowAnonymous>() != null)
        {
            await _next(context);
            return;
        }

        // ── Require authentication for all API endpoints ────────────
        var user = context.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            // Let the standard auth pipeline handle 401
            await _next(context);
            return;
        }

        // ── Super-admin bypass ──────────────────────────────────────
        if (IsSuperAdmin(user))
        {
            await _next(context);
            return;
        }

        // ── Find matching route ─────────────────────────────────────
        var matchedEntry = FindMatchingRoute(method, path);

        if (matchedEntry == null)
        {
            // No mapping found — allow through (covered by [Authorize] if present)
            await _next(context);
            return;
        }

        // ── Null permission = authentication-only ───────────────────
        if (matchedEntry.Permission == null)
        {
            await _next(context);
            return;
        }

        // ── Check permission in database ────────────────────────────
        var systemUserId = user.GetSystemUserId();
        if (!systemUserId.HasValue)
        {
            _logger.LogWarning(
                "Route permission denied — no systemUserId for user {Sub} on {Method} {Path}",
                user.FindFirst("sub")?.Value, method, path);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await WriteJsonError(context, "Forbidden: user identity could not be resolved.");
            return;
        }

        using var scope = context.RequestServices.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();

        var hasPermission = await dbContext.UserRoles
            .Where(ur => ur.UserId == systemUserId.Value)
            .SelectMany(ur => ur.Role.RolePermissions)
            .Where(rp => !rp.Permission.IsDeleted && !rp.Role.IsDeleted)
            .AnyAsync(rp => rp.Permission.Name == matchedEntry.Permission);

        if (!hasPermission)
        {
            _logger.LogWarning(
                "Permission denied: User {UserId} lacks '{Permission}' for {Method} {Path}",
                systemUserId.Value, matchedEntry.Permission, method, path);
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await WriteJsonError(context,
                $"Forbidden: you do not have the '{matchedEntry.Permission}' permission.");
            return;
        }

        await _next(context);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Private helpers
    // ═════════════════════════════════════════════════════════════════════

    private CompiledRouteEntry? FindMatchingRoute(string method, string path)
    {
        // Normalize path for comparison
        var normalizedPath = path.ToLowerInvariant();

        foreach (var entry in _compiledRoutes)
        {
            if (!string.Equals(entry.HttpMethod, method, StringComparison.OrdinalIgnoreCase))
                continue;

            if (entry.Pattern.IsMatch(normalizedPath))
                return entry;
        }

        return null;
    }

    /// <summary>
    /// Converts a route pattern like "api/radius/users/*/sessions"
    /// into a Regex that matches actual request paths.
    /// * matches a single path segment (UUID, int, etc.)
    /// {id}, {uuid}, etc. are also treated as single-segment wildcards.
    /// </summary>
    private static Regex CompilePattern(string routePattern)
    {
        var escaped = Regex.Escape(routePattern.ToLowerInvariant());

        // Replace escaped wildcard \* with a segment matcher
        escaped = escaped.Replace("\\*", "[^/]+");

        // Replace {param} placeholders (already escaped as \{param\})
        escaped = Regex.Replace(escaped, @"\\\{[^}]+\\\}", "[^/]+");

        return new Regex($"^{escaped}$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    }

    /// <summary>
    /// Keycloak admin/super-admin detection — same logic as PermissionAuthorizationHandler.
    /// </summary>
    private static bool IsSuperAdmin(ClaimsPrincipal user)
    {
        var adminRoles = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "admin", "administrator", "super-administrator", "Super Administrator"
        };

        // Check realm_access JSON claim
        var realmRoles = user.FindAll("realm_access")
            .SelectMany(c =>
            {
                try
                {
                    var json = System.Text.Json.JsonDocument.Parse(c.Value);
                    if (json.RootElement.TryGetProperty("roles", out var roles))
                        return roles.EnumerateArray().Select(r => r.GetString() ?? "");
                }
                catch { }
                return Enumerable.Empty<string>();
            });

        if (realmRoles.Any(r => adminRoles.Contains(r)))
            return true;

        var roleClaims = user.FindAll(ClaimTypes.Role).Select(c => c.Value)
            .Concat(user.FindAll("role").Select(c => c.Value));

        return roleClaims.Any(r => adminRoles.Contains(r));
    }

    private static async Task WriteJsonError(HttpContext context, string message)
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = 403,
            error = "Forbidden",
            message
        });
    }

    // ── Types ───────────────────────────────────────────────────────

    private record CompiledRouteEntry(
        string HttpMethod,
        Regex Pattern,
        string OriginalPattern,
        string? Permission);
}

/// <summary>
/// Extension method to register the permission middleware in the pipeline.
/// </summary>
public static class PermissionMiddlewareExtensions
{
    public static IApplicationBuilder UsePermissionAuthorization(this IApplicationBuilder app)
    {
        return app.UseMiddleware<PermissionAuthorizationMiddleware>();
    }
}
