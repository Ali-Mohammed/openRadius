using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspaces/{WorkspaceId}/radius/nas")]
public class RadiusNasController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RadiusNasController> _logger;

    public RadiusNasController(ApplicationDbContext context, ILogger<RadiusNasController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/workspaces/{WorkspaceId}/radius/nas
    [HttpGet]
    public async Task<ActionResult<object>> GetNasDevices(
        int WorkspaceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var query = _context.RadiusNasDevices
            .Where(n => n.WorkspaceId == WorkspaceId && (includeDeleted || !n.IsDeleted));

        // Apply search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(n =>
                (n.Nasname != null && n.Nasname.ToLower().Contains(searchLower)) ||
                (n.Shortname != null && n.Shortname.ToLower().Contains(searchLower)) ||
                (n.Description != null && n.Description.ToLower().Contains(searchLower)) ||
                (n.Version != null && n.Version.ToLower().Contains(searchLower))
            );
        }

        // Apply sorting
        if (!string.IsNullOrWhiteSpace(sortField))
        {
            var isDescending = sortDirection?.ToLower() == "desc";
            query = sortField.ToLower() switch
            {
                "nasname" => isDescending ? query.OrderByDescending(n => n.Nasname) : query.OrderBy(n => n.Nasname),
                "shortname" => isDescending ? query.OrderByDescending(n => n.Shortname) : query.OrderBy(n => n.Shortname),
                "type" => isDescending ? query.OrderByDescending(n => n.Type) : query.OrderBy(n => n.Type),
                "version" => isDescending ? query.OrderByDescending(n => n.Version) : query.OrderBy(n => n.Version),
                "enabled" => isDescending ? query.OrderByDescending(n => n.Enabled) : query.OrderBy(n => n.Enabled),
                "monitor" => isDescending ? query.OrderByDescending(n => n.Monitor) : query.OrderBy(n => n.Monitor),
                "pingtime" => isDescending ? query.OrderByDescending(n => n.PingTime) : query.OrderBy(n => n.PingTime),
                "pingloss" => isDescending ? query.OrderByDescending(n => n.PingLoss) : query.OrderBy(n => n.PingLoss),
                "createdat" => isDescending ? query.OrderByDescending(n => n.CreatedAt) : query.OrderBy(n => n.CreatedAt),
                _ => query.OrderByDescending(n => n.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(n => n.CreatedAt);
        }

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var nasDevices = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = new
        {
            data = nasDevices,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalRecords,
                totalPages
            }
        };

        return Ok(response);
    }

    // GET: api/workspaces/{WorkspaceId}/radius/nas/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<RadiusNas>> GetNasDevice(int WorkspaceId, int id)
    {
        var nasDevice = await _context.RadiusNasDevices
            .FirstOrDefaultAsync(n => n.Id == id && n.WorkspaceId == WorkspaceId && !n.IsDeleted);

        if (nasDevice == null)
        {
            return NotFound(new { message = "NAS device not found" });
        }

        return Ok(nasDevice);
    }

    // POST: api/workspaces/{WorkspaceId}/radius/nas
    [HttpPost]
    public async Task<ActionResult<RadiusNas>> CreateNasDevice(int WorkspaceId, [FromBody] CreateRadiusNasRequest request)
    {
        try
        {
            // Check if NAS with same name already exists
            var existingNas = await _context.RadiusNasDevices
                .FirstOrDefaultAsync(n => n.Nasname == request.Nasname && n.WorkspaceId == WorkspaceId && !n.IsDeleted);

            if (existingNas != null)
            {
                return BadRequest(new { message = "A NAS device with this name already exists" });
            }

            var nasDevice = new RadiusNas
            {
                Nasname = request.Nasname,
                Shortname = request.Shortname,
                Type = request.Type,
                Secret = request.Secret,
                ApiUsername = request.ApiUsername,
                ApiPassword = request.ApiPassword,
                CoaPort = request.CoaPort,
                Version = request.Version,
                Description = request.Description,
                Server = request.Server,
                Enabled = request.Enabled,
                SiteId = request.SiteId,
                HttpPort = request.HttpPort,
                Monitor = request.Monitor,
                IpAccountingEnabled = request.IpAccountingEnabled,
                PoolName = request.PoolName,
                ApiPort = request.ApiPort,
                SnmpCommunity = request.SnmpCommunity,
                SshUsername = request.SshUsername,
                SshPassword = request.SshPassword,
                SshPort = request.SshPort,
                WorkspaceId = WorkspaceId,
                CreatedBy = 1, // TODO: Get from authenticated user context
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.RadiusNasDevices.Add(nasDevice);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetNasDevice), new { WorkspaceId, id = nasDevice.Id }, nasDevice);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating NAS device");
            return StatusCode(500, new { message = "Failed to create NAS device" });
        }
    }

    // PUT: api/workspaces/{WorkspaceId}/radius/nas/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateNasDevice(int WorkspaceId, int id, [FromBody] UpdateRadiusNasRequest request)
    {
        try
        {
            var nasDevice = await _context.RadiusNasDevices
                .FirstOrDefaultAsync(n => n.Id == id && n.WorkspaceId == WorkspaceId && !n.IsDeleted);

            if (nasDevice == null)
            {
                return NotFound(new { message = "NAS device not found" });
            }

            // Check if updating nasname would create a duplicate
            if (request.Nasname != null && request.Nasname != nasDevice.Nasname)
            {
                var existingNas = await _context.RadiusNasDevices
                    .FirstOrDefaultAsync(n => n.Nasname == request.Nasname && n.WorkspaceId == WorkspaceId && n.Id != id && !n.IsDeleted);

                if (existingNas != null)
                {
                    return BadRequest(new { message = "A NAS device with this name already exists" });
                }
            }

            // Update fields if provided
            if (request.Nasname != null) nasDevice.Nasname = request.Nasname;
            if (request.Shortname != null) nasDevice.Shortname = request.Shortname;
            if (request.Type.HasValue) nasDevice.Type = request.Type.Value;
            if (request.Secret != null) nasDevice.Secret = request.Secret;
            if (request.ApiUsername != null) nasDevice.ApiUsername = request.ApiUsername;
            if (request.ApiPassword != null) nasDevice.ApiPassword = request.ApiPassword;
            if (request.CoaPort.HasValue) nasDevice.CoaPort = request.CoaPort.Value;
            if (request.Version != null) nasDevice.Version = request.Version;
            if (request.Description != null) nasDevice.Description = request.Description;
            if (request.Server != null) nasDevice.Server = request.Server;
            if (request.Enabled.HasValue) nasDevice.Enabled = request.Enabled.Value;
            if (request.SiteId.HasValue) nasDevice.SiteId = request.SiteId;
            if (request.HttpPort.HasValue) nasDevice.HttpPort = request.HttpPort.Value;
            if (request.Monitor.HasValue) nasDevice.Monitor = request.Monitor.Value;
            if (request.IpAccountingEnabled.HasValue) nasDevice.IpAccountingEnabled = request.IpAccountingEnabled.Value;
            if (request.PoolName != null) nasDevice.PoolName = request.PoolName;
            if (request.ApiPort.HasValue) nasDevice.ApiPort = request.ApiPort;
            if (request.SnmpCommunity != null) nasDevice.SnmpCommunity = request.SnmpCommunity;
            if (request.SshUsername != null) nasDevice.SshUsername = request.SshUsername;
            if (request.SshPassword != null) nasDevice.SshPassword = request.SshPassword;
            if (request.SshPort.HasValue) nasDevice.SshPort = request.SshPort.Value;

            nasDevice.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(nasDevice);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating NAS device {Id}", id);
            return StatusCode(500, new { message = "Failed to update NAS device" });
        }
    }

    // DELETE: api/workspaces/{WorkspaceId}/radius/nas/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNasDevice(int WorkspaceId, int id)
    {
        var nasDevice = await _context.RadiusNasDevices
            .FirstOrDefaultAsync(n => n.Id == id && n.WorkspaceId == WorkspaceId && !n.IsDeleted);

        if (nasDevice == null)
        {
            return NotFound(new { message = "NAS device not found" });
        }

        nasDevice.IsDeleted = true;
        nasDevice.DeletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/workspaces/{WorkspaceId}/radius/nas/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreNasDevice(int WorkspaceId, int id)
    {
        var nasDevice = await _context.RadiusNasDevices
            .FirstOrDefaultAsync(n => n.Id == id && n.WorkspaceId == WorkspaceId && n.IsDeleted);

        if (nasDevice == null)
        {
            return NotFound(new { message = "Deleted NAS device not found" });
        }

        nasDevice.IsDeleted = false;
        nasDevice.DeletedAt = null;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // GET: api/workspaces/{WorkspaceId}/radius/nas/trash
    [HttpGet("trash")]
    public async Task<ActionResult<object>> GetDeletedNasDevices(
        int WorkspaceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.RadiusNasDevices
            .Where(n => n.WorkspaceId == WorkspaceId && n.IsDeleted);

        var totalRecords = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

        var nasDevices = await query
            .OrderByDescending(n => n.DeletedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var response = new
        {
            data = nasDevices,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalRecords,
                totalPages
            }
        };

        return Ok(response);
    }

    // GET: api/workspaces/{WorkspaceId}/radius/nas/stats
    [HttpGet("stats")]
    public async Task<ActionResult<object>> GetNasStats(int WorkspaceId)
    {
        try
        {
            var totalNas = await _context.RadiusNasDevices
                .CountAsync(n => n.WorkspaceId == WorkspaceId && !n.IsDeleted);

            var enabledNas = await _context.RadiusNasDevices
                .CountAsync(n => n.WorkspaceId == WorkspaceId && !n.IsDeleted && n.Enabled == 1);

            var monitoredNas = await _context.RadiusNasDevices
                .CountAsync(n => n.WorkspaceId == WorkspaceId && !n.IsDeleted && n.Monitor == 1);

            var deletedNas = await _context.RadiusNasDevices
                .CountAsync(n => n.WorkspaceId == WorkspaceId && n.IsDeleted);

            return Ok(new
            {
                total = totalNas,
                enabled = enabledNas,
                monitored = monitoredNas,
                deleted = deletedNas
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching NAS statistics");
            return StatusCode(500, new { message = "Failed to fetch NAS statistics" });
        }
    }
}
