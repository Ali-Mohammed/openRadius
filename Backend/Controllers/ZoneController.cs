using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/workspace/{workspaceId}/[controller]")]
public class ZoneController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ZoneController(
        ApplicationDbContext context,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    private string? GetCurrentUserId()
    {
        return _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
    }

    // GET: api/workspace/{workspaceId}/zone
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ZoneResponse>>> GetZones(int workspaceId)
    {
        var zones = await _context.Zones
            .Where(z => z.WorkspaceId == workspaceId && !z.IsDeleted)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                WorkspaceId = z.WorkspaceId,
                CreatedAt = z.CreatedAt,
                CreatedBy = z.CreatedBy,
                UpdatedAt = z.UpdatedAt,
                UpdatedBy = z.UpdatedBy,
                UserCount = z.UserZones.Count,
                RadiusUserCount = z.RadiusUsers.Count(ru => !z.IsDeleted)
            })
            .ToListAsync();

        return Ok(zones);
    }

    // GET: api/workspace/{workspaceId}/zone/deleted
    [HttpGet("deleted")]
    public async Task<ActionResult<IEnumerable<ZoneResponse>>> GetDeletedZones(int workspaceId)
    {
        var zones = await _context.Zones
            .Where(z => z.WorkspaceId == workspaceId && z.IsDeleted)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                WorkspaceId = z.WorkspaceId,
                CreatedAt = z.CreatedAt,
                CreatedBy = z.CreatedBy,
                UpdatedAt = z.UpdatedAt,
                UpdatedBy = z.UpdatedBy,
                DeletedAt = z.DeletedAt,
                DeletedBy = z.DeletedBy,
                UserCount = z.UserZones.Count,
                RadiusUserCount = z.RadiusUsers.Count(ru => !ru.IsDeleted)
            })
            .ToListAsync();

        return Ok(zones);
    }

    // GET: api/workspace/{workspaceId}/zone/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<ZoneResponse>> GetZone(int workspaceId, int id)
    {
        var zone = await _context.Zones
            .Where(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                WorkspaceId = z.WorkspaceId,
                CreatedAt = z.CreatedAt,
                CreatedBy = z.CreatedBy,
                UpdatedAt = z.UpdatedAt,
                UpdatedBy = z.UpdatedBy,
                UserCount = z.UserZones.Count,
                RadiusUserCount = z.RadiusUsers.Count(ru => !ru.IsDeleted)
            })
            .FirstOrDefaultAsync();

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        return Ok(zone);
    }

    // POST: api/workspace/{workspaceId}/zone
    [HttpPost]
    public async Task<ActionResult<ZoneResponse>> CreateZone(int workspaceId, [FromBody] ZoneCreateDto dto)
    {
        var userId = GetCurrentUserId();

        var zone = new Zone
        {
            Name = dto.Name,
            Description = dto.Description,
            Color = dto.Color,
            Icon = dto.Icon,
            WorkspaceId = workspaceId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId
        };

        _context.Zones.Add(zone);
        await _context.SaveChangesAsync();

        var response = new ZoneResponse
        {
            Id = zone.Id,
            Name = zone.Name,
            Description = zone.Description,
            Color = zone.Color,
            Icon = zone.Icon,
            WorkspaceId = zone.WorkspaceId,
            CreatedAt = zone.CreatedAt,
            CreatedBy = zone.CreatedBy,
            UpdatedAt = zone.UpdatedAt,
            UpdatedBy = zone.UpdatedBy,
            UserCount = 0,
            RadiusUserCount = 0
        };

        return CreatedAtAction(nameof(GetZone), new { workspaceId, id = zone.Id }, response);
    }

    // PUT: api/workspace/{workspaceId}/zone/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<ZoneResponse>> UpdateZone(int workspaceId, int id, [FromBody] ZoneUpdateDto dto)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        var userId = GetCurrentUserId();

        if (dto.Name != null) zone.Name = dto.Name;
        if (dto.Description != null) zone.Description = dto.Description;
        if (dto.Color != null) zone.Color = dto.Color;
        if (dto.Icon != null) zone.Icon = dto.Icon;
        
        zone.UpdatedAt = DateTime.UtcNow;
        zone.UpdatedBy = userId;

        await _context.SaveChangesAsync();

        var response = await _context.Zones
            .Where(z => z.Id == id)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                WorkspaceId = z.WorkspaceId,
                CreatedAt = z.CreatedAt,
                CreatedBy = z.CreatedBy,
                UpdatedAt = z.UpdatedAt,
                UpdatedBy = z.UpdatedBy,
                UserCount = z.UserZones.Count,
                RadiusUserCount = z.RadiusUsers.Count(ru => !ru.IsDeleted)
            })
            .FirstAsync();

        return Ok(response);
    }

    // DELETE: api/workspace/{workspaceId}/zone/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteZone(int workspaceId, int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        var userId = GetCurrentUserId();

        zone.IsDeleted = true;
        zone.DeletedAt = DateTime.UtcNow;
        zone.DeletedBy = userId;

        // Remove zone assignment from radius users
        var radiusUsers = await _context.RadiusUsers
            .Where(ru => ru.ZoneId == id)
            .ToListAsync();

        foreach (var user in radiusUsers)
        {
            user.ZoneId = null;
        }

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/workspace/{workspaceId}/zone/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreZone(int workspaceId, int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Deleted zone not found" });
        }

        var userId = GetCurrentUserId();

        zone.IsDeleted = false;
        zone.DeletedAt = null;
        zone.DeletedBy = null;
        zone.UpdatedAt = DateTime.UtcNow;
        zone.UpdatedBy = userId;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/workspace/{workspaceId}/zone/{id}/assign-users
    [HttpPost("{id}/assign-users")]
    public async Task<IActionResult> AssignUsersToZone(int workspaceId, int id, [FromBody] AssignUsersToZoneDto dto)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        var userId = GetCurrentUserId();

        // Remove existing assignments
        var existingAssignments = await _context.UserZones
            .Where(uz => uz.ZoneId == id)
            .ToListAsync();
        _context.UserZones.RemoveRange(existingAssignments);

        // Add new assignments
        foreach (var managementUserId in dto.UserIds)
        {
            var userZone = new UserZone
            {
                UserId = managementUserId,
                ZoneId = id,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = userId
            };
            _context.UserZones.Add(userZone);
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Users assigned successfully", count = dto.UserIds.Count });
    }

    // GET: api/workspace/{workspaceId}/zone/{id}/users
    [HttpGet("{id}/users")]
    public async Task<ActionResult<IEnumerable<string>>> GetZoneUsers(int workspaceId, int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        var userIds = await _context.UserZones
            .Where(uz => uz.ZoneId == id)
            .Select(uz => uz.UserId)
            .ToListAsync();

        return Ok(userIds);
    }

    // POST: api/workspace/{workspaceId}/zone/{id}/assign-radius-users
    [HttpPost("{id}/assign-radius-users")]
    public async Task<IActionResult> AssignRadiusUsersToZone(int workspaceId, int id, [FromBody] AssignRadiusUsersToZoneDto dto)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        var radiusUsers = await _context.RadiusUsers
            .Where(ru => dto.RadiusUserIds.Contains(ru.Id) && !ru.IsDeleted)
            .ToListAsync();

        foreach (var user in radiusUsers)
        {
            user.ZoneId = id;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Radius users assigned successfully", count = radiusUsers.Count });
    }

    // GET: api/workspace/{workspaceId}/zone/{id}/radius-users
    [HttpGet("{id}/radius-users")]
    public async Task<ActionResult<IEnumerable<object>>> GetZoneRadiusUsers(int workspaceId, int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && z.WorkspaceId == workspaceId && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        var radiusUsers = await _context.RadiusUsers
            .Where(ru => ru.ZoneId == id && !ru.IsDeleted)
            .Select(ru => new
            {
                ru.Id,
                ru.Username,
                ru.Firstname,
                ru.Lastname,
                ru.Email,
                ru.Phone
            })
            .ToListAsync();

        return Ok(radiusUsers);
    }
}
