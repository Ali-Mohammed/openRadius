using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ZoneController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ZoneController(
        ApplicationDbContext context,
        MasterDbContext masterContext,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _masterContext = masterContext;
        _httpContextAccessor = httpContextAccessor;
    }

    private string? GetCurrentUserId()
    {
        return _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
    }

    // GET: api/zone/flat - Returns flat list of all zones (for dropdowns/selections)
    [HttpGet("flat")]
    public async Task<ActionResult<IEnumerable<ZoneResponse>>> GetZonesFlat()
    {
        var allZones = await _context.Zones
            .Where(z => !z.IsDeleted)
            .Include(z => z.ParentZone)
            .OrderBy(z => z.Name)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                Icon = z.Icon,
                ParentZoneId = z.ParentZoneId,
                ParentZoneName = z.ParentZone != null ? z.ParentZone.Name : null,
                CreatedAt = z.CreatedAt,
                UserCount = z.UserZones.Count,
                RadiusUserCount = z.RadiusUsers.Count(ru => !ru.IsDeleted)
            })
            .ToListAsync();

        return Ok(allZones);
    }

    // GET: api/zone
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ZoneResponse>>> GetZones()
    {
        var allZones = await _context.Zones
            .Where(z => !z.IsDeleted)
            .Include(z => z.ParentZone)
            .Include(z => z.UserZones)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                Icon = z.Icon,
                ParentZoneId = z.ParentZoneId,
                ParentZoneName = z.ParentZone != null ? z.ParentZone.Name : null,
                CreatedAt = z.CreatedAt,
                CreatedBy = z.CreatedBy,
                UpdatedAt = z.UpdatedAt,
                UpdatedBy = z.UpdatedBy,
                UserCount = z.UserZones.Count,
                RadiusUserCount = z.RadiusUsers.Count(ru => !ru.IsDeleted)
            })
            .ToListAsync();

        // Get all user IDs from zones
        var userIds = allZones
            .SelectMany(z => _context.UserZones
                .Where(uz => uz.ZoneId == z.Id)
                .Select(uz => uz.UserId))
            .Distinct()
            .ToList();

        // Fetch users from master context
        var users = await _masterContext.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
            .ToListAsync();

        var userDict = users
            .GroupBy(u => u.Id)
            .ToDictionary(g => g.Key, g => g.First());

        // Populate user information for each zone
        foreach (var zone in allZones)
        {
            var zoneUserIds = await _context.UserZones
                .Where(uz => uz.ZoneId == zone.Id)
                .Select(uz => uz.UserId)
                .ToListAsync();

            zone.Users = zoneUserIds
                .Where(uid => userDict.ContainsKey(uid))
                .Select(uid => new UserBasicInfo
                {
                    Id = uid.ToString(),
                    Name = $"{userDict[uid].FirstName} {userDict[uid].LastName}",
                    Email = userDict[uid].Email
                })
                .ToList();
        }

        // Build hierarchical structure
        var rootZones = BuildHierarchy(allZones);
        
        // Calculate total counts including descendants
        CalculateTotalCounts(rootZones);

        return Ok(rootZones);
    }

    private List<ZoneResponse> BuildHierarchy(List<ZoneResponse> zones)
    {
        var lookup = zones.ToLookup(z => z.ParentZoneId);
        
        foreach (var zone in zones)
        {
            zone.Children = lookup[zone.Id].ToList();
        }
        
        return lookup[null].ToList();
    }

    private void CalculateTotalCounts(List<ZoneResponse> zones)
    {
        foreach (var zone in zones)
        {
            CalculateZoneTotalCounts(zone);
        }
    }

    private (int userCount, int radiusUserCount) CalculateZoneTotalCounts(ZoneResponse zone)
    {
        // Start with this zone's direct counts
        int totalUserCount = zone.UserCount;
        int totalRadiusUserCount = zone.RadiusUserCount;

        // Add counts from all children recursively
        foreach (var child in zone.Children)
        {
            var childCounts = CalculateZoneTotalCounts(child);
            totalUserCount += childCounts.userCount;
            totalRadiusUserCount += childCounts.radiusUserCount;
        }

        // Update the zone with total counts
        zone.UserCount = totalUserCount;
        zone.RadiusUserCount = totalRadiusUserCount;

        return (totalUserCount, totalRadiusUserCount);
    }

    // GET: api/zone/deleted
    [HttpGet("deleted")]
    public async Task<ActionResult<IEnumerable<ZoneResponse>>> GetDeletedZones()
    {
        var zones = await _context.Zones
            .IgnoreQueryFilters()
            .Where(z => z.IsDeleted)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                Icon = z.Icon,
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

    // GET: api/zone/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<ZoneResponse>> GetZone(int id)
    {
        var zone = await _context.Zones
            .Where(z => z.Id == id && !z.IsDeleted)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                Icon = z.Icon,
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

    // POST: api/zone
    [HttpPost]
    public async Task<ActionResult<ZoneResponse>> CreateZone([FromBody] ZoneCreateDto dto)
    {
        var zone = new Zone
        {
            Name = dto.Name,
            Description = dto.Description,
            Color = dto.Color,
            Icon = dto.Icon,
            ParentZoneId = dto.ParentZoneId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = User.GetSystemUserId()
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
            ParentZoneId = zone.ParentZoneId,
            CreatedAt = zone.CreatedAt,
            CreatedBy = zone.CreatedBy,
            UpdatedAt = zone.UpdatedAt,
            UpdatedBy = zone.UpdatedBy,
            UserCount = 0,
            RadiusUserCount = 0
        };

        return CreatedAtAction(nameof(GetZone), new { id = zone.Id }, response);
    }

    // PUT: api/zone/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<ZoneResponse>> UpdateZone(int id, [FromBody] ZoneUpdateDto dto)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        if (dto.Name != null) zone.Name = dto.Name;
        if (dto.Description != null) zone.Description = dto.Description;
        if (dto.Color != null) zone.Color = dto.Color;
        if (dto.Icon != null) zone.Icon = dto.Icon;
        if (dto.ParentZoneId.HasValue) zone.ParentZoneId = dto.ParentZoneId;
        
        zone.UpdatedAt = DateTime.UtcNow;
        zone.UpdatedBy = User.GetSystemUserId();

        await _context.SaveChangesAsync();

        var response = await _context.Zones
            .Where(z => z.Id == id)
            .Include(z => z.ParentZone)
            .Select(z => new ZoneResponse
            {
                Id = z.Id,
                Name = z.Name,
                Description = z.Description,
                Color = z.Color,
                Icon = z.Icon,
                ParentZoneId = z.ParentZoneId,
                ParentZoneName = z.ParentZone != null ? z.ParentZone.Name : null,
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

    // DELETE: api/zone/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteZone(int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && !z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Zone not found" });
        }

        zone.IsDeleted = true;
        zone.DeletedAt = DateTime.UtcNow;
        zone.DeletedBy = User.GetSystemUserId();

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

    // POST: api/zone/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreZone(int id)
    {
        var zone = await _context.Zones
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(z => z.Id == id && z.IsDeleted);

        if (zone == null)
        {
            return NotFound(new { message = "Deleted zone not found" });
        }

        zone.IsDeleted = false;
        zone.DeletedAt = null;
        zone.DeletedBy = null;
        zone.UpdatedAt = DateTime.UtcNow;
        zone.UpdatedBy = User.GetSystemUserId();

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/zone/{id}/assign-users
    [HttpPost("{id}/assign-users")]
    public async Task<IActionResult> AssignUsersToZone(int id, [FromBody] AssignUsersToZoneDto dto)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && !z.IsDeleted);

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
            // Parse user ID string to int (system user ID)
            if (!int.TryParse(managementUserId, out var systemUserId))
                continue;
                
            var userZone = new UserZone
            {
                UserId = systemUserId,
                ZoneId = id,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };
            _context.UserZones.Add(userZone);
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Users assigned successfully", count = dto.UserIds.Count });
    }

    // GET: api/zone/{id}/users
    [HttpGet("{id}/users")]
    public async Task<ActionResult<IEnumerable<string>>> GetZoneUsers(int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && !z.IsDeleted);

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

    // POST: api/zone/{id}/assign-radius-users
    [HttpPost("{id}/assign-radius-users")]
    public async Task<IActionResult> AssignRadiusUsersToZone(int id, [FromBody] AssignRadiusUsersToZoneDto dto)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && !z.IsDeleted);

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

    // GET: api/zone/{id}/radius-users
    [HttpGet("{id}/radius-users")]
    public async Task<ActionResult<IEnumerable<object>>> GetZoneRadiusUsers(int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(z => z.Id == id && !z.IsDeleted);

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
