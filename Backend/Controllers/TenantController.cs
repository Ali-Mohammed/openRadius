using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Security.Claims;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenantController : ControllerBase
{
    private readonly MasterDbContext _masterDbContext;
    private readonly ILogger<TenantController> _logger;

    public TenantController(MasterDbContext masterDbContext, ILogger<TenantController> logger)
    {
        _masterDbContext = masterDbContext;
        _logger = logger;
    }

    /// <summary>
    /// Get available instants/tenants for the current user
    /// </summary>
    [HttpGet("available")]
    public async Task<ActionResult<IEnumerable<AvailableTenantDto>>> GetAvailableTenants()
    {
        var workspaces = await _masterDbContext.Workspaces
            .Where(i => i.DeletedAt == null && i.Status == "active")
            .Select(i => new AvailableTenantDto
            {
                Id = i.Id,
                Name = i.Name,
                Title = i.Title,
                Location = i.Location,
                Description = i.Description
            })
            .ToListAsync();

        return Ok(workspaces);
    }

    /// <summary>
    /// Get current user's tenant preferences
    /// </summary>
    [HttpGet("current")]
    public async Task<ActionResult<UserTenantPreferenceDto>> GetCurrentTenant()
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(userEmail))
        {
            return Unauthorized(new { message = "User email not found in token" });
        }

        var user = await _masterDbContext.Users
            .Include(u => u.CurrentWorkspace)
            .Include(u => u.DefaultWorkspace)
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var response = new UserTenantPreferenceDto
        {
            CurrentWorkspaceId = user.CurrentWorkspaceId,
            CurrentWorkspaceName = user.CurrentWorkspace?.Title,
            DefaultWorkspaceId = user.DefaultWorkspaceId,
            DefaultWorkspaceName = user.DefaultWorkspace?.Title
        };

        return Ok(response);
    }

    /// <summary>
    /// Switch to a different instant/tenant for the current session
    /// </summary>
    [HttpPost("switch")]
    public async Task<ActionResult> SwitchTenant([FromBody] SwitchTenantRequest request)
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(userEmail))
        {
            return Unauthorized(new { message = "User email not found in token" });
        }

        // Verify the workspace exists and is active
        var workspace = await _masterDbContext.Workspaces
            .FirstOrDefaultAsync(i => i.Id == request.WorkspaceId && i.DeletedAt == null);

        if (workspace == null)
        {
            return NotFound(new { message = "Workspace not found or inactive" });
        }

        // Update user's current workspace
        var user = await _masterDbContext.Users
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.CurrentWorkspaceId = request.WorkspaceId;
        await _masterDbContext.SaveChangesAsync();

        _logger.LogInformation($"User {userEmail} switched to workspace {workspace.Title} (ID: {workspace.Id})");

        return Ok(new 
        { 
            message = "Tenant switched successfully",
            tenantId = workspace.Id,
            tenantName = workspace.Title,
            // Return the tenant ID as a header for the client to use in subsequent requests
            tenantHeader = "X-Tenant-Id",
            tenantHeaderValue = workspace.Id.ToString()
        });
    }

    /// <summary>
    /// Set default instant/tenant for the user
    /// </summary>
    [HttpPost("set-default")]
    public async Task<ActionResult> SetDefaultTenant([FromBody] SwitchTenantRequest request)
    {
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");
        if (string.IsNullOrEmpty(userEmail))
        {
            return Unauthorized(new { message = "User email not found in token" });
        }

        // Verify the workspace exists and is active
        var workspace = await _masterDbContext.Workspaces
            .FirstOrDefaultAsync(i => i.Id == request.WorkspaceId && i.DeletedAt == null);

        if (workspace == null)
        {
            return NotFound(new { message = "Workspace not found or inactive" });
        }

        // Update user's default workspace
        var user = await _masterDbContext.Users
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.DefaultWorkspaceId = request.WorkspaceId;
        
        // If current workspace is not set, also set it as current
        if (user.CurrentWorkspaceId == null)
        {
            user.CurrentWorkspaceId = request.WorkspaceId;
        }
        
        await _masterDbContext.SaveChangesAsync();

        _logger.LogInformation($"User {userEmail} set default workspace to {workspace.Title} (ID: {workspace.Id})");

        return Ok(new 
        { 
            message = "Default tenant set successfully",
            tenantId = workspace.Id,
            tenantName = workspace.Title
        });
    }
}

public class SwitchTenantRequest
{
    public int WorkspaceId { get; set; }
}

public class AvailableTenantDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class UserTenantPreferenceDto
{
    public int? CurrentWorkspaceId { get; set; }
    public string? CurrentWorkspaceName { get; set; }
    public int? DefaultWorkspaceId { get; set; }
    public string? DefaultWorkspaceName { get; set; }
}




