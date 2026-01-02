using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using System.Security.Claims;

namespace Backend.Services;

/// <summary>
/// Resolves the current tenant based on user's CurrentInstantId from JWT claims or header.
/// Falls back to DefaultInstantId if CurrentInstantId is not set.
/// </summary>
public class UserInstantTenantResolver : IMultiTenantStrategy
{
    private readonly MasterDbContext _masterDbContext;

    public UserInstantTenantResolver(MasterDbContext masterDbContext)
    {
        _masterDbContext = masterDbContext;
    }

    public async Task<string?> GetIdentifierAsync(object context)
    {
        if (context is not HttpContext httpContext)
            return null;

        // Try to get tenant from custom header first (for tenant switching)
        var tenantHeader = httpContext.Request.Headers["X-Tenant-Id"].FirstOrDefault();
        if (!string.IsNullOrEmpty(tenantHeader))
        {
            return tenantHeader;
        }

        // Get user email from JWT claims
        var userEmail = httpContext.User.FindFirstValue(ClaimTypes.Email) 
                        ?? httpContext.User.FindFirstValue("email");
        
        if (string.IsNullOrEmpty(userEmail))
            return null;

        // Look up user's current or default instant
        var user = await _masterDbContext.Users
            .Include(u => u.CurrentInstant)
            .Include(u => u.DefaultInstant)
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
            return null;

        // Use CurrentInstant if set, otherwise fall back to DefaultInstant
        var instantId = user.CurrentInstantId ?? user.DefaultInstantId;
        
        return instantId?.ToString();
    }
}
