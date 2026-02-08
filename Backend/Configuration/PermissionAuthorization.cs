using Backend.Data;
using Backend.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace Backend.Configuration;

// ── Requirement ─────────────────────────────────────────────────────────────

/// <summary>
/// An authorization requirement that demands the user hold a specific
/// application-level permission (e.g. "server-monitoring.view").
/// </summary>
public class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }

    public PermissionRequirement(string permission)
    {
        Permission = permission ?? throw new ArgumentNullException(nameof(permission));
    }
}

// ── Handler ─────────────────────────────────────────────────────────────────

/// <summary>
/// Evaluates <see cref="PermissionRequirement"/> by loading the user's
/// permissions from the database (User → UserRoles → Role → RolePermissions → Permission).
/// Keycloak admin/super-admin roles bypass the check automatically.
/// </summary>
public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PermissionAuthorizationHandler> _logger;

    // Keycloak realm roles that grant full access (kept in sync with NavigationService)
    private static readonly HashSet<string> AdminRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "admin",
        "administrator",
        "super-administrator",
        "Super Administrator"
    };

    public PermissionAuthorizationHandler(
        IServiceScopeFactory scopeFactory,
        ILogger<PermissionAuthorizationHandler> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var user = context.User;

        if (user?.Identity?.IsAuthenticated != true)
            return; // Not authenticated — fail silently, [Authorize] will return 401

        // ── Super-admin bypass ──────────────────────────────────────────
        if (IsSuperAdmin(user))
        {
            context.Succeed(requirement);
            return;
        }

        // ── Resolve system user id from claims ──────────────────────────
        var systemUserId = user.GetSystemUserId();
        if (!systemUserId.HasValue)
        {
            _logger.LogWarning(
                "Permission check failed — no systemUserId claim for user {Sub}",
                user.FindFirst("sub")?.Value);
            return; // Fail — will result in 403
        }

        // ── Load permissions from database ──────────────────────────────
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<MasterDbContext>();

        var hasPermission = await dbContext.UserRoles
            .Where(ur => ur.UserId == systemUserId.Value)
            .SelectMany(ur => ur.Role.RolePermissions)
            .Where(rp => !rp.Permission.IsDeleted && !rp.Role.IsDeleted)
            .AnyAsync(rp => rp.Permission.Name == requirement.Permission);

        if (hasPermission)
        {
            context.Succeed(requirement);
        }
        else
        {
            _logger.LogWarning(
                "Permission denied: User {UserId} lacks '{Permission}'",
                systemUserId.Value, requirement.Permission);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private static bool IsSuperAdmin(ClaimsPrincipal user)
    {
        // Check realm_access JSON claim (Keycloak token structure)
        var realmRoles = user.FindAll("realm_access")
            .SelectMany(c =>
            {
                try
                {
                    var json = System.Text.Json.JsonDocument.Parse(c.Value);
                    if (json.RootElement.TryGetProperty("roles", out var roles))
                        return roles.EnumerateArray().Select(r => r.GetString() ?? "");
                }
                catch { /* Ignore */ }
                return Enumerable.Empty<string>();
            });

        if (realmRoles.Any(r => AdminRoles.Contains(r)))
            return true;

        // Also check individual role claims
        var roleClaims = user.FindAll(ClaimTypes.Role).Select(c => c.Value)
            .Concat(user.FindAll("role").Select(c => c.Value));

        return roleClaims.Any(r => AdminRoles.Contains(r));
    }
}

// ── Attribute ───────────────────────────────────────────────────────────────

/// <summary>
/// Declarative attribute that enforces a specific permission on a controller or action.
/// Usage: <c>[RequirePermission("server-monitoring.view")]</c>
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class RequirePermissionAttribute : AuthorizeAttribute
{
    /// <summary>
    /// The permission being enforced (e.g. "server-monitoring.view").
    /// </summary>
    public string Permission { get; }

    public RequirePermissionAttribute(string permission)
        : base(policy: $"Permission:{permission}")
    {
        Permission = permission;
    }
}

// ── Policy Provider ─────────────────────────────────────────────────────────

/// <summary>
/// Dynamically creates authorization policies for any "Permission:xxx" policy name
/// so we don't have to register every single permission up front.
/// </summary>
public class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private const string PolicyPrefix = "Permission:";
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(PolicyPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var permission = policyName[PolicyPrefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return _fallback.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() =>
        _fallback.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() =>
        _fallback.GetFallbackPolicyAsync();
}
