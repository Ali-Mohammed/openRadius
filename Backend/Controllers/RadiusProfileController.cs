using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{WorkspaceId}/radius/profiles")]
public class RadiusProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly ISasSyncService _syncService;
    private readonly ILogger<RadiusProfileController> _logger;

    public RadiusProfileController(
        ApplicationDbContext context, 
        MasterDbContext masterContext, 
        ISasSyncService syncService,
        ILogger<RadiusProfileController> logger)
    {
        _context = context;
        _masterContext = masterContext;
        _syncService = syncService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetProfiles(
        int WorkspaceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] bool includeDeleted = false,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = null)
    {
        var query = _context.RadiusProfiles
            .Where(p => p.WorkspaceId == WorkspaceId && (includeDeleted || !p.IsDeleted));

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower();
            query = query.Where(p =>
                (p.Name != null && p.Name.ToLower().Contains(search)) ||
                (p.Pool != null && p.Pool.ToLower().Contains(search))
            );
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "name" => isDescending ? query.OrderByDescending(p => p.Name) : query.OrderBy(p => p.Name),
                "enabled" => isDescending ? query.OrderByDescending(p => p.Enabled) : query.OrderBy(p => p.Enabled),
                "downrate" => isDescending ? query.OrderByDescending(p => p.Downrate) : query.OrderBy(p => p.Downrate),
                "uprate" => isDescending ? query.OrderByDescending(p => p.Uprate) : query.OrderBy(p => p.Uprate),
                "price" => isDescending ? query.OrderByDescending(p => p.Price) : query.OrderBy(p => p.Price),
                "pool" => isDescending ? query.OrderByDescending(p => p.Pool) : query.OrderBy(p => p.Pool),
                "usercount" => isDescending ? query.OrderByDescending(p => p.UsersCount) : query.OrderBy(p => p.UsersCount),
                "monthly" => isDescending ? query.OrderByDescending(p => p.Monthly) : query.OrderBy(p => p.Monthly),
                "type" => isDescending ? query.OrderByDescending(p => p.Type) : query.OrderBy(p => p.Type),
                _ => query.OrderByDescending(p => p.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(p => p.CreatedAt);
        }

        var profiles = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new RadiusProfileResponse
            {
                Id = p.Id,
                ExternalId = p.ExternalId,
                Name = p.Name,
                Enabled = p.Enabled,
                Type = p.Type,
                Downrate = p.Downrate,
                Uprate = p.Uprate,
                Pool = p.Pool,
                Price = p.Price,
                Monthly = p.Monthly,
                BurstEnabled = p.BurstEnabled,
                LimitExpiration = p.LimitExpiration,
                ExpirationAmount = p.ExpirationAmount,
                ExpirationUnit = p.ExpirationUnit,
                SiteId = p.SiteId,
                OnlineUsersCount = p.OnlineUsersCount,
                UsersCount = p.UsersCount,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt
            })
            .ToListAsync();

        return Ok(new
        {
            data = profiles,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusProfileResponse>> GetProfile(int WorkspaceId, int id)
    {
        var profile = await _context.RadiusProfiles
            .Where(p => p.Id == id && p.WorkspaceId == WorkspaceId)
            .Select(p => new RadiusProfileResponse
            {
                Id = p.Id,
                ExternalId = p.ExternalId,
                Name = p.Name,
                Enabled = p.Enabled,
                Type = p.Type,
                Downrate = p.Downrate,
                Uprate = p.Uprate,
                Pool = p.Pool,
                Price = p.Price,
                Monthly = p.Monthly,
                BurstEnabled = p.BurstEnabled,
                LimitExpiration = p.LimitExpiration,
                ExpirationAmount = p.ExpirationAmount,
                ExpirationUnit = p.ExpirationUnit,
                SiteId = p.SiteId,
                OnlineUsersCount = p.OnlineUsersCount,
                UsersCount = p.UsersCount,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt
            })
            .FirstOrDefaultAsync();

        if (profile == null)
        {
            return NotFound();
        }

        return Ok(profile);
    }

    [HttpPost]
    public async Task<ActionResult<RadiusProfileResponse>> CreateProfile(int WorkspaceId, [FromBody] CreateProfileRequest request)
    {
        var workspace = await _masterContext.Workspaces.FindAsync(WorkspaceId);
        if (workspace == null)
        {
            return NotFound($"Workspace with ID {WorkspaceId} not found");
        }

        var profile = new RadiusProfile
        {
            Name = request.Name,
            Enabled = request.Enabled,
            Type = request.Type,
            Downrate = request.Downrate,
            Uprate = request.Uprate,
            Pool = request.Pool,
            Price = request.Price,
            Monthly = request.Monthly,
            BurstEnabled = request.BurstEnabled,
            LimitExpiration = request.LimitExpiration,
            ExpirationAmount = request.ExpirationAmount,
            ExpirationUnit = request.ExpirationUnit,
            SiteId = request.SiteId,
            WorkspaceId = WorkspaceId,
            ExternalId = 0,
            OnlineUsersCount = 0,
            UsersCount = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            LastSyncedAt = DateTime.UtcNow
        };

        _context.RadiusProfiles.Add(profile);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created radius profile {Name} for instant {WorkspaceId}", profile.Name, WorkspaceId);

        var response = new RadiusProfileResponse
        {
            Id = profile.Id,
            ExternalId = profile.ExternalId,
            Name = profile.Name,
            Enabled = profile.Enabled,
            Type = profile.Type,
            Downrate = profile.Downrate,
            Uprate = profile.Uprate,
            Pool = profile.Pool,
            Price = profile.Price,
            Monthly = profile.Monthly,
            BurstEnabled = profile.BurstEnabled,
            LimitExpiration = profile.LimitExpiration,
            ExpirationAmount = profile.ExpirationAmount,
            ExpirationUnit = profile.ExpirationUnit,
            SiteId = profile.SiteId,
            OnlineUsersCount = profile.OnlineUsersCount,
            UsersCount = profile.UsersCount,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt,
            LastSyncedAt = profile.LastSyncedAt
        };

        return CreatedAtAction(nameof(GetProfile), new { WorkspaceId, id = profile.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProfile(int WorkspaceId, int id, [FromBody] UpdateProfileRequest request)
    {
        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.WorkspaceId == WorkspaceId);

        if (profile == null)
        {
            return NotFound();
        }

        profile.Name = request.Name;
        profile.Enabled = request.Enabled;
        profile.Type = request.Type;
        profile.Downrate = request.Downrate;
        profile.Uprate = request.Uprate;
        profile.Pool = request.Pool;
        profile.Price = request.Price;
        profile.Monthly = request.Monthly;
        profile.BurstEnabled = request.BurstEnabled;
        profile.LimitExpiration = request.LimitExpiration;
        profile.ExpirationAmount = request.ExpirationAmount;
        profile.ExpirationUnit = request.ExpirationUnit;
        profile.SiteId = request.SiteId;
        profile.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated radius profile {Name} for instant {WorkspaceId}", profile.Name, WorkspaceId);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProfile(int WorkspaceId, int id)
    {
        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.WorkspaceId == WorkspaceId && !p.IsDeleted);

        if (profile == null)
        {
            return NotFound();
        }

        profile.IsDeleted = true;
        profile.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Soft deleted radius profile {Name} for workspace {WorkspaceId}", profile.Name, WorkspaceId);

        return NoContent();
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreProfile(int WorkspaceId, int id)
    {
        var profile = await _context.RadiusProfiles
            .FirstOrDefaultAsync(p => p.Id == id && p.WorkspaceId == WorkspaceId && p.IsDeleted);

        if (profile == null)
        {
            return NotFound(new { message = "Deleted profile not found" });
        }

        profile.IsDeleted = false;
        profile.DeletedAt = null;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Restored radius profile {Name} for workspace {WorkspaceId}", profile.Name, WorkspaceId);

        return NoContent();
    }

    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedProfiles(
        int WorkspaceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.RadiusProfiles
            .Where(p => p.WorkspaceId == WorkspaceId && p.IsDeleted);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var profiles = await query
            .OrderByDescending(p => p.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new RadiusProfileResponse
            {
                Id = p.Id,
                ExternalId = p.ExternalId,
                Name = p.Name,
                Enabled = p.Enabled,
                Type = p.Type,
                Downrate = p.Downrate,
                Uprate = p.Uprate,
                Pool = p.Pool,
                Price = p.Price,
                Monthly = p.Monthly,
                BurstEnabled = p.BurstEnabled,
                LimitExpiration = p.LimitExpiration,
                ExpirationAmount = p.ExpirationAmount,
                ExpirationUnit = p.ExpirationUnit,
                SiteId = p.SiteId,
                OnlineUsersCount = p.OnlineUsersCount,
                UsersCount = p.UsersCount,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                LastSyncedAt = p.LastSyncedAt
            })
            .ToListAsync();

        return Ok(new
        {
            data = profiles,
            pagination = new
            {
                currentPage = page,
                pageSize = pageSize,
                totalRecords = totalRecords,
                totalPages = totalPages
            }
        });
    }

    [HttpPost("sync")]
    public async Task<ActionResult<SyncProfileResponse>> SyncProfiles(int WorkspaceId, [FromQuery] bool fullSync = false)
    {
        try
        {
            // Get the active SAS Radius integration for this workspace
            var integration = await _context.SasRadiusIntegrations
                .FirstOrDefaultAsync(i => i.WorkspaceId == WorkspaceId && i.IsActive && !i.IsDeleted);

            if (integration == null)
            {
                return BadRequest(new { error = "No active SAS Radius integration found for this workspace" });
            }

            // Start the sync using the SAS sync service
            var syncId = await _syncService.SyncAsync(integration.Id, WorkspaceId, fullSync);
            
            _logger.LogInformation("Started profile sync {SyncId} for workspace {WorkspaceId}", syncId, WorkspaceId);

            return Ok(new
            {
                syncId = syncId.ToString(),
                message = "Profile sync started successfully. Connect to SignalR hub at /hubs/sassync and join group with syncId to receive real-time updates.",
                integrationId = integration.Id,
                integrationName = integration.Name,
                workspaceId = WorkspaceId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start profile sync for workspace {WorkspaceId}", WorkspaceId);
            return StatusCode(500, new { error = "Failed to start profile synchronization", details = ex.Message });
        }
    }
}





