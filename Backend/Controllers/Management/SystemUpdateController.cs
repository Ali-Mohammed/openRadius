using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers.Management;

/// <summary>
/// Provides endpoints for checking and applying Docker-based system updates.
/// Only manages backend and frontend containers — all other services remain stable.
/// </summary>
[ApiController]
[Route("api/system-update")]
[Authorize]
public class SystemUpdateController : ControllerBase
{
    private readonly ISystemUpdateService _updateService;
    private readonly ILogger<SystemUpdateController> _logger;

    public SystemUpdateController(
        ISystemUpdateService updateService,
        ILogger<SystemUpdateController> logger)
    {
        _updateService = updateService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/system-update/status
    /// Checks Docker Hub for latest image versions and compares with running containers.
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<SystemUpdateStatusResponse>> GetUpdateStatus()
    {
        try
        {
            _logger.LogInformation("System update status check requested");
            var status = await _updateService.CheckForUpdatesAsync();
            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking system update status");
            return StatusCode(500, new { error = "Failed to check update status", message = ex.Message });
        }
    }

    /// <summary>
    /// POST /api/system-update/update/{serviceName}
    /// Pulls the latest image and restarts a specific service (backend or frontend).
    /// </summary>
    [HttpPost("update/{serviceName}")]
    public async Task<ActionResult<ServiceUpdateResult>> UpdateService(string serviceName)
    {
        if (string.IsNullOrWhiteSpace(serviceName))
            return BadRequest(new { error = "Service name is required" });

        var validServices = new[] { "backend", "frontend" };
        if (!validServices.Contains(serviceName.ToLower()))
            return BadRequest(new { error = $"Invalid service: {serviceName}. Must be 'backend' or 'frontend'" });

        try
        {
            _logger.LogInformation("Update requested for service: {Service}", serviceName);
            var result = await _updateService.UpdateServiceAsync(serviceName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating service {Service}", serviceName);
            return StatusCode(500, new { error = "Failed to update service", message = ex.Message });
        }
    }

    /// <summary>
    /// POST /api/system-update/update-all
    /// Pulls and restarts both backend and frontend services.
    /// </summary>
    [HttpPost("update-all")]
    public async Task<ActionResult<List<ServiceUpdateResult>>> UpdateAll()
    {
        try
        {
            _logger.LogInformation("Update all services requested");
            var results = await _updateService.UpdateAllAsync();
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating all services");
            return StatusCode(500, new { error = "Failed to update services", message = ex.Message });
        }
    }
}
