using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using System.Security.Claims;

namespace Backend.Services;

/// <summary>
/// Resolves the current tenant based on user's CurrentWorkspaceId from JWT claims or header.
/// Falls back to DefaultWorkspaceId if CurrentWorkspaceId is not set.
/// </summary>
public class UserWorkspaceTenantResolver : IMultiTenantStrategy
{
    private readonly MasterDbContext _masterDbContext;
    private readonly ILogger<UserWorkspaceTenantResolver> _logger;

    public UserWorkspaceTenantResolver(MasterDbContext masterDbContext, ILogger<UserWorkspaceTenantResolver> logger)
    {
        _masterDbContext = masterDbContext;
        _logger = logger;
    }

    public async Task<string?> GetIdentifierAsync(object context)
    {
        if (context is not HttpContext httpContext)
            return null;

        // Log all available claims for debugging (don't require IsAuthenticated)
        var claims = httpContext.User.Claims.ToList();
        if (claims.Any())
        {
            var claimsStr = string.Join(", ", claims.Select(c => $"{c.Type}={c.Value}"));
            _logger.LogInformation($"Available claims in tenant resolver: {claimsStr}");
        }
        
        // Get user email from JWT claims (check multiple possible claim types)
        var userEmail = httpContext.User.FindFirstValue("email") 
                        ?? httpContext.User.FindFirstValue(ClaimTypes.Email)
                        ?? httpContext.User.FindFirstValue("preferred_username");
        
        if (string.IsNullOrEmpty(userEmail))
        {
            _logger.LogWarning("No email claim found in JWT token");
            return null;
        }

        _logger.LogInformation($"Found email claim: {userEmail}");

        // Look up user's current or default workspace from Users table in master database
        var user = await _masterDbContext.Users
            .Include(u => u.CurrentWorkspace)
            .Include(u => u.DefaultWorkspace)
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            _logger.LogWarning($"User not found in database: {userEmail}");
            return null;
        }

        // Use CurrentWorkspace if set, otherwise fall back to DefaultWorkspace
        var workspaceId = user.CurrentWorkspaceId ?? user.DefaultWorkspaceId;
        
        _logger.LogInformation($"Resolved tenant for user {userEmail}: WorkspaceId={workspaceId} (Current={user.CurrentWorkspaceId}, Default={user.DefaultWorkspaceId})");
        
        return workspaceId?.ToString();
    }
}


