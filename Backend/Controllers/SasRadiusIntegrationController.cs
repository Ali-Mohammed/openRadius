using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/instants/{instantId}/sas-radius")]
public class SasRadiusIntegrationController : ControllerBase
{
    private readonly MasterDbContext _context;
    private readonly ISasSyncService _syncService;
    private readonly ILogger<SasRadiusIntegrationController> _logger;

    public SasRadiusIntegrationController(
        MasterDbContext context, 
        ISasSyncService syncService,
        ILogger<SasRadiusIntegrationController> logger)
    {
        _context = context;
        _syncService = syncService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SasRadiusIntegration>>> GetIntegrations(int instantId)
    {
        var integrations = await _context.SasRadiusIntegrations
            .Where(i => i.InstantId == instantId)
            .OrderByDescending(i => i.IsActive)
            .ThenBy(i => i.Name)
            .ToListAsync();

        return Ok(integrations);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SasRadiusIntegration>> GetIntegration(int instantId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (integration == null)
        {
            return NotFound();
        }

        return Ok(integration);
    }

    [HttpPost]
    public async Task<ActionResult<SasRadiusIntegration>> CreateIntegration(int instantId, [FromBody] SasRadiusIntegration integration)
    {
        // Verify instant exists
        var instant = await _context.Instants.FindAsync(instantId);
        if (instant == null)
        {
            return NotFound($"Instant with ID {instantId} not found");
        }

        // If this integration is marked as active, deactivate all others for this instant
        if (integration.IsActive)
        {
            var activeIntegrations = await _context.SasRadiusIntegrations
                .Where(i => i.InstantId == instantId && i.IsActive)
                .ToListAsync();

            foreach (var activeIntegration in activeIntegrations)
            {
                activeIntegration.IsActive = false;
                activeIntegration.UpdatedAt = DateTime.UtcNow;
            }
        }

        integration.InstantId = instantId;
        integration.CreatedAt = DateTime.UtcNow;
        integration.UpdatedAt = DateTime.UtcNow;

        _context.SasRadiusIntegrations.Add(integration);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created SAS Radius integration {Name} for instant {InstantId}", integration.Name, instantId);

        return CreatedAtAction(nameof(GetIntegration), new { instantId, id = integration.Id }, integration);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIntegration(int instantId, int id, [FromBody] SasRadiusIntegration integration)
    {
        if (id != integration.Id)
        {
            return BadRequest("ID mismatch");
        }

        var existingIntegration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (existingIntegration == null)
        {
            return NotFound();
        }

        // If this integration is being marked as active, deactivate all others for this instant
        if (integration.IsActive && !existingIntegration.IsActive)
        {
            var activeIntegrations = await _context.SasRadiusIntegrations
                .Where(i => i.InstantId == instantId && i.IsActive && i.Id != id)
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
        existingIntegration.Action = integration.Action;
        existingIntegration.Description = integration.Description;
        existingIntegration.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated SAS Radius integration {Name} for instant {InstantId}", integration.Name, instantId);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteIntegration(int instantId, int id)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (integration == null)
        {
            return NotFound();
        }

        _context.SasRadiusIntegrations.Remove(integration);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted SAS Radius integration {Name} for instant {InstantId}", integration.Name, instantId);

        return NoContent();
    }

    [HttpPost("{id}/sync")]
    public async Task<ActionResult> SyncIntegration(int instantId, int id, [FromQuery] bool fullSync = false)
    {
        var integration = await _context.SasRadiusIntegrations
            .FirstOrDefaultAsync(i => i.Id == id && i.InstantId == instantId);

        if (integration == null)
        {
            return NotFound();
        }

        try
        {
            var syncId = await _syncService.SyncAsync(id, instantId, fullSync);
            
            _logger.LogInformation("Started sync {SyncId} for SAS Radius integration {Name}", syncId, integration.Name);

            return Ok(new
            {
                syncId = syncId.ToString(),
                message = "Sync started successfully. Connect to SignalR hub at /hubs/sassync and join group with syncId to receive real-time updates.",
                integrationId = id,
                integrationName = integration.Name,
                instantId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start sync for integration {Name}", integration.Name);
            return StatusCode(500, new { error = "Failed to start synchronization", details = ex.Message });
        }
    }

    [HttpGet("syncs/active")]
    public async Task<ActionResult<IEnumerable<SyncProgress>>> GetActiveSyncs(int instantId)
    {
        var activeSyncs = await _context.SyncProgresses
            .Where(s => s.InstantId == instantId && 
                       s.Status != SyncStatus.Completed && 
                       s.Status != SyncStatus.Failed &&
                       s.Status != SyncStatus.Cancelled)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync();

        return Ok(activeSyncs);
    }

    [HttpPost("syncs/{syncId}/cancel")]
    public async Task<ActionResult> CancelSync(int instantId, Guid syncId)
    {
        var sync = await _context.SyncProgresses
            .FirstOrDefaultAsync(s => s.SyncId == syncId && s.InstantId == instantId);

        if (sync == null)
        {
            return NotFound(new { error = "Sync not found" });
        }

        if (sync.Status == SyncStatus.Completed || sync.Status == SyncStatus.Failed || sync.Status == SyncStatus.Cancelled)
        {
            return BadRequest(new { error = "Sync is already completed, failed, or cancelled" });
        }

        var cancelled = await _syncService.CancelSyncAsync(syncId, instantId);
        
        if (cancelled)
        {
            _logger.LogInformation("Cancelled sync {SyncId} for instant {InstantId}", syncId, instantId);
            return Ok(new { message = "Sync cancelled successfully", syncId });
        }
        else
        {
            return BadRequest(new { error = "Failed to cancel sync. It may have already completed." });
        }
    }

    [HttpGet("syncs/{syncId}")]
    public async Task<ActionResult<SyncProgress>> GetSyncProgress(int instantId, Guid syncId)
    {
        var sync = await _context.SyncProgresses
            .FirstOrDefaultAsync(s => s.SyncId == syncId && s.InstantId == instantId);

        if (sync == null)
        {
            return NotFound();
        }

        return Ok(sync);
    }

    [HttpGet("syncs")]
    public async Task<ActionResult<object>> GetAllSyncs(
        int instantId, 
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = "startedAt",
        [FromQuery] string? sortDirection = "desc",
        [FromQuery] int? status = null)
    {
        var query = _context.SyncProgresses
            .Where(s => s.InstantId == instantId);

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
}
