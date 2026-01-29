using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Services;
using Backend.Models;
using Finbuckle.MultiTenant.Abstractions;

namespace Backend.Controllers.Network;

[Authorize]
[ApiController]
[Route("api/workspaces/{workspaceId}/session-sync")]
public class SessionSyncController : ControllerBase
{
    private readonly ISessionSyncService _sessionSyncService;
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;
    private readonly ILogger<SessionSyncController> _logger;

    public SessionSyncController(
        ISessionSyncService sessionSyncService,
        IMultiTenantContextAccessor<WorkspaceTenantInfo> tenantAccessor,
        ILogger<SessionSyncController> logger)
    {
        _sessionSyncService = sessionSyncService;
        _tenantAccessor = tenantAccessor;
        _logger = logger;
    }

    [HttpPost("start/{integrationId}")]
    public async Task<ActionResult<Guid>> StartSync(int workspaceId, int integrationId)
    {
        try
        {
            // Use the actual workspace from tenant context, not from URL
            var actualWorkspaceId = _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? workspaceId;
            _logger.LogInformation("StartSync: URL workspaceId={UrlWorkspaceId}, Actual workspaceId={ActualWorkspaceId}", 
                workspaceId, actualWorkspaceId);
            
            var syncId = await _sessionSyncService.StartSessionSyncAsync(integrationId, actualWorkspaceId);
            return Ok(new { syncId, message = "Session sync started successfully" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start session sync for integration {IntegrationId}", integrationId);
            return StatusCode(500, new { message = "Failed to start session sync", error = ex.Message });
        }
    }

    [HttpGet("progress/{syncId}")]
    public async Task<ActionResult<SessionSyncProgress>> GetProgress(int workspaceId, Guid syncId)
    {
        try
        {
            var progress = await _sessionSyncService.GetSyncProgressAsync(syncId);
            
            if (progress == null)
            {
                return NotFound(new { message = "Sync progress not found" });
            }

            return Ok(progress);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get session sync progress for {SyncId}", syncId);
            return StatusCode(500, new { message = "Failed to get sync progress", error = ex.Message });
        }
    }

    [HttpGet("logs/{integrationId}")]
    public async Task<ActionResult<List<SessionSyncLog>>> GetLogs(int workspaceId, int integrationId)
    {
        try
        {
            // Use the actual workspace from tenant context, not from URL
            var actualWorkspaceId = _tenantAccessor.MultiTenantContext?.TenantInfo?.WorkspaceId ?? workspaceId;
            _logger.LogInformation("GetLogs: URL workspaceId={UrlWorkspaceId}, Actual workspaceId={ActualWorkspaceId}", 
                workspaceId, actualWorkspaceId);
            
            var logs = await _sessionSyncService.GetSyncLogsAsync(integrationId, actualWorkspaceId);
            return Ok(logs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get session sync logs for integration {IntegrationId}", integrationId);
            return StatusCode(500, new { message = "Failed to get sync logs", error = ex.Message });
        }
    }

    [HttpPost("cancel/{syncId}")]
    public async Task<ActionResult> CancelSync(int workspaceId, Guid syncId)
    {
        try
        {
            await _sessionSyncService.CancelSyncAsync(syncId);
            return Ok(new { message = "Sync cancelled successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cancel session sync {SyncId}", syncId);
            return StatusCode(500, new { message = "Failed to cancel sync", error = ex.Message });
        }
    }
}
