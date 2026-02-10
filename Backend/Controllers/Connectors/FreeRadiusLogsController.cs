using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Backend.Helpers;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[NoAudit]
public class FreeRadiusLogsController : ControllerBase
{
    private readonly IFreeRadiusLogService _logService;
    private readonly ILogger<FreeRadiusLogsController> _logger;

    public FreeRadiusLogsController(
        IFreeRadiusLogService logService,
        ILogger<FreeRadiusLogsController> logger)
    {
        _logService = logService;
        _logger = logger;
    }

    /// <summary>
    /// Get FreeRADIUS logs with filtering options
    /// </summary>
    [HttpPost("fetch")]
    public async Task<ActionResult<LogsResponse>> GetLogs([FromBody] LogFilter filter)
    {
        try
        {
            var isRunning = await _logService.IsFreeRadiusRunningAsync();
            if (!isRunning)
            {
                return BadRequest(new { message = "FreeRADIUS container is not running" });
            }

            var logs = await _logService.GetLogsAsync(filter);
            return Ok(logs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch FreeRADIUS logs");
            return StatusCode(500, new { message = "Failed to fetch logs", error = ex.Message });
        }
    }

    /// <summary>
    /// Get log statistics (auth success/failure counts, errors)
    /// </summary>
    [HttpGet("statistics")]
    public async Task<ActionResult<LogStatistics>> GetStatistics()
    {
        try
        {
            var stats = await _logService.GetLogStatisticsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get log statistics");
            return StatusCode(500, new { message = "Failed to get statistics", error = ex.Message });
        }
    }

    /// <summary>
    /// Get radwtmp entries (user login/logout history)
    /// </summary>
    [HttpGet("radwtmp")]
    public async Task<ActionResult<List<RadwtmpEntry>>> GetRadwtmpEntries([FromQuery] int limit = 50)
    {
        try
        {
            var entries = await _logService.GetRadwtmpEntriesAsync(limit);
            return Ok(entries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get radwtmp entries");
            return StatusCode(500, new { message = "Failed to get radwtmp entries", error = ex.Message });
        }
    }

    /// <summary>
    /// Check if FreeRADIUS container is running
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<object>> GetStatus()
    {
        try
        {
            var isRunning = await _logService.IsFreeRadiusRunningAsync();
            return Ok(new { isRunning, containerName = "freeradius" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to check FreeRADIUS status");
            return StatusCode(500, new { message = "Failed to check status", error = ex.Message });
        }
    }

    /// <summary>
    /// Get available log types
    /// </summary>
    [HttpGet("types")]
    public ActionResult<object> GetLogTypes()
    {
        return Ok(new
        {
            types = new[]
            {
                new { value = "radius", label = "General Logs (radius.log)", description = "All FreeRADIUS operational logs" },
                new { value = "auth", label = "Authentication Logs (auth.log)", description = "Authentication-specific logs" },
                new { value = "radwtmp", label = "Login History (radwtmp)", description = "User login/logout history" }
            }
        });
    }
}
