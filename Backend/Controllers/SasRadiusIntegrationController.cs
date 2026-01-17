using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{WorkspaceId}/sas-radius")]
public class SasRadiusIntegrationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ISasSyncService _syncService;
    private readonly ILogger<SasRadiusIntegrationController> _logger;

    public SasRadiusIntegrationController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        ISasSyncService syncService,
        ILogger<SasRadiusIntegrationController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _syncService = syncService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetIntegrations(int WorkspaceId, [FromQuery] bool includeDeleted = false)
    {
        var integrations = await _context.SasRadiusIntegrations
            .Where(i => i.WorkspaceId == WorkspaceId && (includeDeleted || !i.IsDeleted))
            .OrderByDescending(i => i.IsActive)
            .ThenBy(i => i.Name)
            .ToListAsync();

        // Get latest sync status for each integration
        var integrationIds = integrations.Select(i => i.Id).ToList();
        var latestSyncs = await _context.SyncProgresses
            .Where(s => integrationIds.Contains(s.IntegrationId))
            .GroupBy(s => s.IntegrationId)
            .Select(g => g.OrderByDescending(s => s.StartedAt).FirstOrDefault())
            .ToListAsync();

        var result = integrations.Select(integration => new
        {
            integration.Id,
            integration.Name,
            integration.Url,
            integration.Username,
            integration.Password,
            integration.UseHttps,
            integration.IsActive,
            integration.MaxItemInPagePerRequest,
            integration.Action,
            integration.Description,
            integration.WorkspaceId,
            integration.CreatedAt,
            integration.UpdatedAt,
            integration.IsDeleted,
            LatestSyncStatus = latestSyncs.FirstOrDefault(s => s?.IntegrationId == integration.Id)?.Status,
            LatestSyncDate = latestSyncs.FirstOrDefault(s => s?.IntegrationId == integration.Id)?.StartedAt
        });

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SasRadiusIntegration>> GetIntegration(int WorkspaceId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.WorkspaceId == WorkspaceId);

        if (integration == null)
        {
            return NotFound();
        }

        return Ok(integration);
    }

    [HttpPost]
    public async Task<ActionResult<SasRadiusIntegration>> CreateIntegration(int WorkspaceId, [FromBody] SasRadiusIntegration integration)
    {
        // Verify workspace exists
        var workspace = await _masterContext.Workspaces.FindAsync(WorkspaceId);
        if (workspace == null)
        {
            return NotFound($"Workspace with ID {WorkspaceId} not found");
        }

        // If this integration is marked as active, deactivate all others for this workspace
        if (integration.IsActive)
        {
            var activeIntegrations = await _context.SasRadiusIntegrations
                .Where(i => i.WorkspaceId == WorkspaceId && i.IsActive)
                .ToListAsync();

            foreach (var activeIntegration in activeIntegrations)
            {
                activeIntegration.IsActive = false;
                activeIntegration.UpdatedAt = DateTime.UtcNow;
            }
        }

        integration.WorkspaceId = WorkspaceId;
        integration.CreatedAt = DateTime.UtcNow;
        integration.UpdatedAt = DateTime.UtcNow;

        _context.SasRadiusIntegrations.Add(integration);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created SAS Radius integration {Name} for instant {WorkspaceId}", integration.Name, WorkspaceId);

        return CreatedAtAction(nameof(GetIntegration), new { WorkspaceId, id = integration.Id }, integration);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIntegration(int WorkspaceId, int id, [FromBody] SasRadiusIntegration integration)
    {
        if (id != integration.Id)
        {
            return BadRequest("ID mismatch");
        }

        var existingIntegration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.WorkspaceId == WorkspaceId);

        if (existingIntegration == null)
        {
            return NotFound();
        }

        // If this integration is being marked as active, deactivate all others for this instant
        if (integration.IsActive && !existingIntegration.IsActive)
        {
            var activeIntegrations = await _context.SasRadiusIntegrations
                .Where(i => i.WorkspaceId == WorkspaceId && i.IsActive && i.Id != id)
                .ToListAsync();

            foreach (var activeIntegration in activeIntegrations)
            {
                activeIntegration.IsActive = false;
                activeIntegration.UpdatedAt = DateTime.UtcNow;
            }
        }

        existingIntegration.Name = integration.Name;
        existingIntegration.Url = integration.Url;
        existingIntegration.Username = integration.Username;
        existingIntegration.Password = integration.Password;
        existingIntegration.UseHttps = integration.UseHttps;
        existingIntegration.IsActive = integration.IsActive;
        existingIntegration.MaxItemInPagePerRequest = integration.MaxItemInPagePerRequest;
        existingIntegration.Action = integration.Action;
        existingIntegration.Description = integration.Description;
        existingIntegration.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated SAS Radius integration {Name} for instant {WorkspaceId}", integration.Name, WorkspaceId);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIntegration(int WorkspaceId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.WorkspaceId == WorkspaceId && !i.IsDeleted);

        if (integration == null)
        {
            return NotFound();
        }

        integration.IsDeleted = true;
        integration.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Soft deleted SAS Radius integration {Name} for workspace {WorkspaceId}", integration.Name, WorkspaceId);

        return NoContent();
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreIntegration(int WorkspaceId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.WorkspaceId == WorkspaceId && i.IsDeleted);

        if (integration == null)
        {
            return NotFound(new { message = "Deleted integration not found" });
        }

        integration.IsDeleted = false;
        integration.DeletedAt = null;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Restored SAS Radius integration {Name} for workspace {WorkspaceId}", integration.Name, WorkspaceId);

        return NoContent();
    }

    [HttpGet("trash")]
    public async Task<ActionResult<IEnumerable<SasRadiusIntegration>>> GetDeletedIntegrations(int WorkspaceId)
    {
        var integrations = await _context.SasRadiusIntegrations
            .Where(i => i.WorkspaceId == WorkspaceId && i.IsDeleted)
            .OrderByDescending(i => i.DeletedAt)
            .ToListAsync();

        return Ok(integrations);
    }

    [HttpPost("{id}/sync")]
    public async Task<ActionResult> SyncIntegration(int id, [FromQuery] bool fullSync = false)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id);

        if (integration == null)
        {
            return NotFound();
        }

        if (!integration.IsActive)
        {
            return BadRequest(new { error = "Cannot sync inactive integration. Please activate the integration first." });
        }

        try
        {
            var syncId = await _syncService.SyncAsync(id, fullSync);
            
            _logger.LogInformation("Started sync {SyncId} for SAS Radius integration {Name}", syncId, integration.Name);

            return Ok(new
            {
                syncId = syncId.ToString(),
                message = "Sync started successfully. Connect to SignalR hub at /hubs/sassync and join group with syncId to receive real-time updates.",
                integrationId = id,
                integrationName = integration.Name
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start sync for integration {Name}", integration.Name);
            return StatusCode(500, new { error = "Failed to start synchronization", details = ex.Message });
        }
    }

    [HttpGet("syncs/active")]
    public async Task<ActionResult<IEnumerable<SyncProgress>>> GetActiveSyncs(int WorkspaceId)
    {
        var activeSyncs = await _context.SyncProgresses
            .Where(s => s.WorkspaceId == WorkspaceId && 
                       s.Status != SyncStatus.Completed && 
                       s.Status != SyncStatus.Failed &&
                       s.Status != SyncStatus.Cancelled)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync();

        return Ok(activeSyncs);
    }

    [HttpPost("syncs/{syncId}/cancel")]
    public async Task<ActionResult> CancelSync(Guid syncId)
    {
        var sync = await _context.SyncProgresses
            .FirstOrDefaultAsync(s => s.SyncId == syncId);

        if (sync == null)
        {
            return NotFound(new { error = "Sync not found" });
        }

        if (sync.Status == SyncStatus.Completed || sync.Status == SyncStatus.Failed || sync.Status == SyncStatus.Cancelled)
        {
            return BadRequest(new { error = "Sync is already completed, failed, or cancelled" });
        }

        var cancelled = await _syncService.CancelSyncAsync(syncId);
        
        if (cancelled)
        {
            _logger.LogInformation("Cancelled sync {SyncId}", syncId);
            return Ok(new { message = "Sync cancelled successfully", syncId });
        }
        else
        {
            return BadRequest(new { error = "Failed to cancel sync. It may have already completed." });
        }
    }

    [HttpGet("syncs/{syncId}")]
    public async Task<ActionResult<SyncProgress>> GetSyncProgress(int WorkspaceId, Guid syncId)
    {
        var sync = await _context.SyncProgresses
            .FirstOrDefaultAsync(s => s.SyncId == syncId && s.WorkspaceId == WorkspaceId);

        if (sync == null)
        {
            return NotFound();
        }

        return Ok(sync);
    }

    [HttpGet("syncs")]
    public async Task<ActionResult<object>> GetAllSyncs(
        int WorkspaceId, 
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = "startedAt",
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] int? status = null)
    {
        var query = _context.SyncProgresses
            .Where(s => s.WorkspaceId == WorkspaceId);

        // Filter by status if provided
        if (status.HasValue)
        {
            query = query.Where(s => s.Status == (SyncStatus)status.Value);
        }

        // Apply sorting
        query = sortBy?.ToLower() switch
        {
            "status" => sortDirection?.ToLower() == "asc" 
                ? query.OrderBy(s => s.Status) 
                : query.OrderByDescending(s => s.Status),
            "integration" => sortDirection?.ToLower() == "asc"
                ? query.OrderBy(s => s.IntegrationName)
                : query.OrderByDescending(s => s.IntegrationName),
            "progress" => sortDirection?.ToLower() == "asc"
                ? query.OrderBy(s => s.ProgressPercentage)
                : query.OrderByDescending(s => s.ProgressPercentage),
            _ => sortDirection?.ToLower() == "asc"
                ? query.OrderBy(s => s.StartedAt)
                : query.OrderByDescending(s => s.StartedAt)
        };

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var syncs = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            data = syncs,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    [HttpGet("export")]
    public async Task<ActionResult> ExportIntegrations(int WorkspaceId)
    {
        try
        {
            var integrations = await _context.SasRadiusIntegrations
                .Where(i => i.WorkspaceId == WorkspaceId && !i.IsDeleted)
                .Select(i => new
                {
                    i.Name,
                    i.Url,
                    i.Username,
                    i.Password,
                    i.UseHttps,
                    i.IsActive,
                    i.MaxItemInPagePerRequest,
                    i.Action,
                    i.Description
                })
                .ToListAsync();

            var json = System.Text.Json.JsonSerializer.Serialize(integrations, new System.Text.Json.JsonSerializerOptions
            {
                WriteIndented = true
            });

            var fileName = $"sas-radius-integrations-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json";
            return File(System.Text.Encoding.UTF8.GetBytes(json), "application/json", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export integrations for workspace {WorkspaceId}", WorkspaceId);
            return StatusCode(500, new { error = "Failed to export integrations", details = ex.Message });
        }
    }

    [HttpPost("import")]
    public async Task<ActionResult> ImportIntegrations(int WorkspaceId, [FromBody] List<SasRadiusIntegrationImport> integrations)
    {
        try
        {
            if (integrations == null || integrations.Count == 0)
            {
                return BadRequest(new { error = "No integrations provided" });
            }

            var imported = 0;
            var skipped = 0;
            var errors = new List<string>();

            foreach (var importData in integrations)
            {
                try
                {
                    // Check if integration with same name already exists
                    var existing = await _context.SasRadiusIntegrations
                        .FirstOrDefaultAsync(i => i.WorkspaceId == WorkspaceId && 
                                                  i.Name == importData.Name && 
                                                  !i.IsDeleted);

                    if (existing != null)
                    {
                        // Update existing integration
                        existing.Url = importData.Url;
                        existing.Username = importData.Username;
                        existing.Password = importData.Password;
                        existing.UseHttps = importData.UseHttps;
                        existing.IsActive = importData.IsActive;
                        existing.MaxItemInPagePerRequest = importData.MaxItemInPagePerRequest;
                        existing.Action = importData.Action;
                        existing.Description = importData.Description;
                        existing.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        // Create new integration
                        var newIntegration = new SasRadiusIntegration
                        {
                            Name = importData.Name,
                            Url = importData.Url,
                            Username = importData.Username,
                            Password = importData.Password,
                            UseHttps = importData.UseHttps,
                            IsActive = importData.IsActive,
                            MaxItemInPagePerRequest = importData.MaxItemInPagePerRequest,
                            Action = importData.Action,
                            Description = importData.Description,
                            WorkspaceId = WorkspaceId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        _context.SasRadiusIntegrations.Add(newIntegration);
                    }

                    imported++;
                }
                catch (Exception ex)
                {
                    skipped++;
                    errors.Add($"Failed to import '{importData.Name}': {ex.Message}");
                    _logger.LogError(ex, "Failed to import integration {Name}", importData.Name);
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"Import completed: {imported} integrations imported/updated, {skipped} skipped",
                imported,
                skipped,
                errors
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import integrations for workspace {WorkspaceId}", WorkspaceId);
            return StatusCode(500, new { error = "Failed to import integrations", details = ex.Message });
        }
    }
}

public class SasRadiusIntegrationImport
{
    public required string Name { get; set; }
    public required string Url { get; set; }
    public required string Username { get; set; }
    public required string Password { get; set; }
    public bool UseHttps { get; set; }
    public bool IsActive { get; set; }
    public int MaxItemInPagePerRequest { get; set; }
    public required string Action { get; set; }
    public string? Description { get; set; }
}





