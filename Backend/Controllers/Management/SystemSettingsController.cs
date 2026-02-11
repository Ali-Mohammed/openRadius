using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

/// <summary>
/// Manages system-wide settings (global, not workspace-scoped).
/// All endpoints require authentication + settings.developer.* permissions
/// enforced by the PermissionAuthorizationMiddleware.
/// </summary>
[ApiController]
[Route("api/system-settings")]
[Authorize]
public class SystemSettingsController : ControllerBase
{
    private readonly ISystemSettingsService _systemSettingsService;
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<SystemSettingsController> _logger;

    public SystemSettingsController(
        ISystemSettingsService systemSettingsService,
        MasterDbContext masterContext,
        ILogger<SystemSettingsController> logger)
    {
        _systemSettingsService = systemSettingsService;
        _masterContext = masterContext;
        _logger = logger;
    }

    /// <summary>
    /// Get the current Swagger enabled/disabled state with audit metadata.
    /// </summary>
    [HttpGet("swagger")]
    public async Task<ActionResult<SwaggerSettingResponseDto>> GetSwaggerSetting()
    {
        var result = await _systemSettingsService.GetSwaggerSettingAsync();
        return Ok(result);
    }

    /// <summary>
    /// Enable or disable the Swagger API documentation endpoint.
    /// Tracks which user made the change and when.
    /// </summary>
    [HttpPut("swagger")]
    public async Task<ActionResult> UpdateSwaggerSetting([FromBody] SwaggerSettingRequestDto request)
    {
        var userId = await GetCurrentUserIdAsync();

        try
        {
            await _systemSettingsService.UpdateSettingAsync(
                SystemSettingKeys.SwaggerEnabled,
                request.Enabled.ToString(),
                userId,
                description: "Controls whether the Swagger API documentation endpoint is accessible",
                category: "Developer"
            );
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }

        _logger.LogInformation(
            "User {UserId} {Action} Swagger API documentation",
            userId,
            request.Enabled ? "enabled" : "disabled");

        return Ok(new { message = $"Swagger has been {(request.Enabled ? "enabled" : "disabled")} successfully" });
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /// <summary>
    /// Resolves the current authenticated user's internal ID from claims → DB.
    /// </summary>
    private async Task<int> GetCurrentUserIdAsync()
    {
        var email = User.FindFirst("email")?.Value ?? User.Identity?.Name;

        if (string.IsNullOrEmpty(email))
            throw new UnauthorizedAccessException("User email not found in claims");

        var user = await _masterContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
            throw new UnauthorizedAccessException($"User not found in database for email: {email}");

        return user.Id;
    }
}
