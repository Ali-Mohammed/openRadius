using Backend.Configuration;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

/// <summary>
/// Provides endpoints for monitoring server resources and Docker containers.
/// Supports viewing container stats, performing lifecycle actions, and retrieving logs.
/// </summary>
[ApiController]
[Route("api/server-monitoring")]
[Authorize]
public class ServerMonitoringController : ControllerBase
{
    private readonly IDockerMonitoringService _dockerService;
    private readonly ILogger<ServerMonitoringController> _logger;

    public ServerMonitoringController(
        IDockerMonitoringService dockerService,
        ILogger<ServerMonitoringController> logger)
    {
        _dockerService = dockerService;
        _logger = logger;
    }

    // ── Server Resources ────────────────────────────────────────────────────

    /// <summary>
    /// GET /api/server-monitoring/resources
    /// Returns host-level CPU, memory, disk usage and system info.
    /// </summary>
    [HttpGet("resources")]
    [RequirePermission("server-monitoring.view")]
    public async Task<ActionResult<ServerResourcesResponse>> GetServerResources()
    {
        try
        {
            var resources = await _dockerService.GetServerResourcesAsync();
            return Ok(resources);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting server resources");
            return StatusCode(500, new { error = "Failed to retrieve server resources" });
        }
    }

    // ── Docker System Info ──────────────────────────────────────────────────

    /// <summary>
    /// GET /api/server-monitoring/docker/info
    /// Returns Docker daemon version, storage, container counts, etc.
    /// </summary>
    [HttpGet("docker/info")]
    [RequirePermission("server-monitoring.view")]
    public async Task<ActionResult<DockerSystemInfoResponse>> GetDockerInfo()
    {
        try
        {
            var info = await _dockerService.GetDockerSystemInfoAsync();
            return Ok(info);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Docker system info");
            return StatusCode(500, new { error = "Failed to retrieve Docker info" });
        }
    }

    // ── Container List ──────────────────────────────────────────────────────

    /// <summary>
    /// GET /api/server-monitoring/containers
    /// Returns all containers with their status and live resource usage.
    /// </summary>
    [HttpGet("containers")]
    [RequirePermission("server-monitoring.view")]
    public async Task<ActionResult<List<ContainerInfoResponse>>> GetContainers(
        [FromQuery] bool includeAll = true)
    {
        try
        {
            var containers = await _dockerService.GetContainersAsync(includeAll);
            return Ok(containers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing Docker containers");
            return StatusCode(500, new { error = "Failed to list containers" });
        }
    }

    // ── Container Stats ─────────────────────────────────────────────────────

    /// <summary>
    /// GET /api/server-monitoring/containers/{containerId}/stats
    /// Returns detailed live stats for a specific container.
    /// </summary>
    [HttpGet("containers/{containerId}/stats")]
    [RequirePermission("server-monitoring.view")]
    public async Task<ActionResult<ContainerStatsResponse>> GetContainerStats(string containerId)
    {
        try
        {
            var stats = await _dockerService.GetContainerStatsAsync(containerId);
            if (stats == null)
                return NotFound(new { error = "Container not found or not running" });

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stats for container {ContainerId}", containerId);
            return StatusCode(500, new { error = "Failed to retrieve container stats" });
        }
    }

    // ── Container Actions ───────────────────────────────────────────────────

    /// <summary>
    /// POST /api/server-monitoring/containers/{containerId}/start
    /// Starts a stopped container.
    /// </summary>
    [HttpPost("containers/{containerId}/start")]
    [RequirePermission("server-monitoring.containers.manage")]
    public async Task<ActionResult<ContainerActionResult>> StartContainer(string containerId)
    {
        try
        {
            _logger.LogInformation("User {User} requested START for container {ContainerId}",
                User.Identity?.Name, containerId);

            var result = await _dockerService.StartContainerAsync(containerId);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting container {ContainerId}", containerId);
            return StatusCode(500, new { error = "Failed to start container" });
        }
    }

    /// <summary>
    /// POST /api/server-monitoring/containers/{containerId}/stop
    /// Stops a running container.
    /// </summary>
    [HttpPost("containers/{containerId}/stop")]
    [RequirePermission("server-monitoring.containers.manage")]
    public async Task<ActionResult<ContainerActionResult>> StopContainer(string containerId)
    {
        try
        {
            _logger.LogInformation("User {User} requested STOP for container {ContainerId}",
                User.Identity?.Name, containerId);

            var result = await _dockerService.StopContainerAsync(containerId);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error stopping container {ContainerId}", containerId);
            return StatusCode(500, new { error = "Failed to stop container" });
        }
    }

    /// <summary>
    /// POST /api/server-monitoring/containers/{containerId}/restart
    /// Restarts a container.
    /// </summary>
    [HttpPost("containers/{containerId}/restart")]
    [RequirePermission("server-monitoring.containers.manage")]
    public async Task<ActionResult<ContainerActionResult>> RestartContainer(string containerId)
    {
        try
        {
            _logger.LogInformation("User {User} requested RESTART for container {ContainerId}",
                User.Identity?.Name, containerId);

            var result = await _dockerService.RestartContainerAsync(containerId);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restarting container {ContainerId}", containerId);
            return StatusCode(500, new { error = "Failed to restart container" });
        }
    }

    // ── Container Logs ──────────────────────────────────────────────────────

    /// <summary>
    /// GET /api/server-monitoring/containers/{containerId}/logs
    /// Returns the last N lines of container logs.
    /// </summary>
    [HttpGet("containers/{containerId}/logs")]
    [RequirePermission("server-monitoring.logs.view")]
    public async Task<ActionResult<ContainerLogsResponse>> GetContainerLogs(
        string containerId,
        [FromQuery] int tail = 200,
        [FromQuery] bool timestamps = true)
    {
        try
        {
            var logs = await _dockerService.GetContainerLogsAsync(containerId, tail, timestamps);
            return Ok(logs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting logs for container {ContainerId}", containerId);
            return StatusCode(500, new { error = "Failed to retrieve container logs" });
        }
    }
}
