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
        var instants = await _masterDbContext.Instants
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

        return Ok(instants);
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
            .Include(u => u.CurrentInstant)
            .Include(u => u.DefaultInstant)
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        var response = new UserTenantPreferenceDto
        {
            CurrentInstantId = user.CurrentInstantId,
            CurrentInstantName = user.CurrentInstant?.Title,
            DefaultInstantId = user.DefaultInstantId,
            DefaultInstantName = user.DefaultInstant?.Title
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

        // Verify the instant exists and is active
        var instant = await _masterDbContext.Instants
            .FirstOrDefaultAsync(i => i.Id == request.InstantId && i.DeletedAt == null);

        if (instant == null)
        {
            return NotFound(new { message = "Instant not found or inactive" });
        }

        // Update user's current instant
        var user = await _masterDbContext.Users
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.CurrentInstantId = request.InstantId;
        await _masterDbContext.SaveChangesAsync();

        _logger.LogInformation($"User {userEmail} switched to instant {instant.Title} (ID: {instant.Id})");

        return Ok(new 
        { 
            message = "Tenant switched successfully",
            tenantId = instant.Id,
            tenantName = instant.Title,
            // Return the tenant ID as a header for the client to use in subsequent requests
            tenantHeader = "X-Tenant-Id",
            tenantHeaderValue = instant.Id.ToString()
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

        // Verify the instant exists and is active
        var instant = await _masterDbContext.Instants
            .FirstOrDefaultAsync(i => i.Id == request.InstantId && i.DeletedAt == null);

        if (instant == null)
        {
            return NotFound(new { message = "Instant not found or inactive" });
        }

        // Update user's default instant
        var user = await _masterDbContext.Users
            .FirstOrDefaultAsync(u => u.Email == userEmail);

        if (user == null)
        {
            return NotFound(new { message = "User not found" });
        }

        user.DefaultInstantId = request.InstantId;
        
        // If current instant is not set, also set it as current
        if (user.CurrentInstantId == null)
        {
            user.CurrentInstantId = request.InstantId;
        }
        
        await _masterDbContext.SaveChangesAsync();

        _logger.LogInformation($"User {userEmail} set default instant to {instant.Title} (ID: {instant.Id})");

        return Ok(new 
        { 
            message = "Default tenant set successfully",
            tenantId = instant.Id,
            tenantName = instant.Title
        });
    }
}

public class SwitchTenantRequest
{
    public int InstantId { get; set; }
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
    public int? CurrentInstantId { get; set; }
    public string? CurrentInstantName { get; set; }
    public int? DefaultInstantId { get; set; }
    public string? DefaultInstantName { get; set; }
}
