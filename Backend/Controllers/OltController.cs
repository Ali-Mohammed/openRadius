using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/network/olts")]
[Authorize]
public class OltController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<OltController> _logger;

    public OltController(
        ApplicationDbContext context,
        ILogger<OltController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<OltDto>>> GetOlts()
    {
        try
        {
            var olts = await _context.Olts
                .Where(o => !o.IsDeleted)
                .Include(o => o.PonPorts.Where(p => !p.IsDeleted))
                .OrderBy(o => o.Name)
                .Select(o => new OltDto
                {
                    Id = o.Id,
                    Name = o.Name,
                    Hostname = o.Hostname,
                    Vendor = o.Vendor,
                    Model = o.Model,
                    SerialNumber = o.SerialNumber,
                    ManagementIp = o.ManagementIp,
                    Status = o.Status,
                    Environment = o.Environment,
                    SiteName = o.SiteName,
                    PonPortCount = o.PonPorts.Count(p => !p.IsDeleted),
                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt
                })
                .ToListAsync();

            return Ok(olts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting OLTs");
            return StatusCode(500, new { message = "Failed to retrieve OLTs", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<OltDetailDto>> GetOlt(Guid id)
    {
        try
        {
            var olt = await _context.Olts
                .Where(o => o.Id == id && !o.IsDeleted)
                .Include(o => o.PonPorts.Where(p => !p.IsDeleted))
                .FirstOrDefaultAsync();

            if (olt == null)
                return NotFound(new { message = "OLT not found" });

            var dto = new OltDetailDto
            {
                Id = olt.Id,
                Name = olt.Name,
                Hostname = olt.Hostname,
                Vendor = olt.Vendor,
                Model = olt.Model,
                SerialNumber = olt.SerialNumber,
                AssetTag = olt.AssetTag,
                Role = olt.Role,
                Environment = olt.Environment,
                Status = olt.Status,
                ManagementIp = olt.ManagementIp,
                ManagementVlan = olt.ManagementVlan,
                LoopbackIp = olt.LoopbackIp,
                MgmtInterface = olt.MgmtInterface,
                SshEnabled = olt.SshEnabled,
                SshPort = olt.SshPort,
                SshUsername = olt.SshUsername,
                SnmpVersion = olt.SnmpVersion,
                SnmpPort = olt.SnmpPort,
                SiteName = olt.SiteName,
                Rack = olt.Rack,
                RackUnit = olt.RackUnit,
                Latitude = olt.Latitude,
                Longitude = olt.Longitude,
                UptimeSeconds = olt.UptimeSeconds,
                CpuUsagePct = olt.CpuUsagePct,
                MemoryUsagePct = olt.MemoryUsagePct,
                TemperatureC = olt.TemperatureC,
                PonPorts = olt.PonPorts.Select(p => new PonPortDto
                {
                    Id = p.Id,
                    Slot = p.Slot,
                    Port = p.Port,
                    Technology = p.Technology,
                    Status = p.Status
                }).ToList(),
                CreatedAt = olt.CreatedAt,
                UpdatedAt = olt.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting OLT {Id}", id);
            return StatusCode(500, new { message = "Failed to retrieve OLT", error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<OltDto>> CreateOlt([FromBody] CreateOltDto dto)
    {
        try
        {
            var olt = new Olt
            {
                Name = dto.Name,
                Hostname = dto.Hostname,
                Vendor = dto.Vendor,
                Model = dto.Model,
                SerialNumber = dto.SerialNumber,
                AssetTag = dto.AssetTag,
                Role = dto.Role,
                Environment = dto.Environment ?? "prod",
                Status = dto.Status ?? "active",
                ManagementIp = dto.ManagementIp,
                ManagementVlan = dto.ManagementVlan,
                LoopbackIp = dto.LoopbackIp,
                MgmtInterface = dto.MgmtInterface,
                SshEnabled = dto.SshEnabled,
                SshPort = dto.SshPort,
                SshUsername = dto.SshUsername,
                SnmpVersion = dto.SnmpVersion,
                SnmpPort = dto.SnmpPort,
                SiteName = dto.SiteName,
                Rack = dto.Rack,
                RackUnit = dto.RackUnit,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude
            };

            _context.Olts.Add(olt);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetOlt), new { id = olt.Id }, new OltDto
            {
                Id = olt.Id,
                Name = olt.Name,
                Vendor = olt.Vendor,
                Model = olt.Model,
                ManagementIp = olt.ManagementIp,
                Status = olt.Status
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating OLT");
            return StatusCode(500, new { message = "Failed to create OLT", error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateOlt(Guid id, [FromBody] UpdateOltDto dto)
    {
        try
        {
            var olt = await _context.Olts.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (olt == null)
                return NotFound(new { message = "OLT not found" });

            olt.Name = dto.Name;
            olt.Hostname = dto.Hostname;
            olt.Vendor = dto.Vendor;
            olt.Model = dto.Model;
            olt.SerialNumber = dto.SerialNumber;
            olt.AssetTag = dto.AssetTag;
            olt.Role = dto.Role;
            olt.Environment = dto.Environment;
            olt.Status = dto.Status;
            olt.ManagementIp = dto.ManagementIp;
            olt.ManagementVlan = dto.ManagementVlan;
            olt.LoopbackIp = dto.LoopbackIp;
            olt.MgmtInterface = dto.MgmtInterface;
            olt.SshEnabled = dto.SshEnabled;
            olt.SshPort = dto.SshPort;
            olt.SshUsername = dto.SshUsername;
            olt.SnmpVersion = dto.SnmpVersion;
            olt.SnmpPort = dto.SnmpPort;
            olt.SiteName = dto.SiteName;
            olt.Rack = dto.Rack;
            olt.RackUnit = dto.RackUnit;
            olt.Latitude = dto.Latitude;
            olt.Longitude = dto.Longitude;
            olt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "OLT updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating OLT {Id}", id);
            return StatusCode(500, new { message = "Failed to update OLT", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteOlt(Guid id)
    {
        try
        {
            var olt = await _context.Olts.FirstOrDefaultAsync(o => o.Id == id && !o.IsDeleted);
            if (olt == null)
                return NotFound(new { message = "OLT not found" });

            olt.IsDeleted = true;
            olt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "OLT deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting OLT {Id}", id);
            return StatusCode(500, new { message = "Failed to delete OLT", error = ex.Message });
        }
    }
}

// DTOs
public class OltDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Hostname { get; set; }
    public string Vendor { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? SerialNumber { get; set; }
    public string ManagementIp { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public string? SiteName { get; set; }
    public int PonPortCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class OltDetailDto : OltDto
{
    public string? AssetTag { get; set; }
    public string? Role { get; set; }
    public int? ManagementVlan { get; set; }
    public string? LoopbackIp { get; set; }
    public string? MgmtInterface { get; set; }
    public bool SshEnabled { get; set; }
    public int SshPort { get; set; }
    public string? SshUsername { get; set; }
    public string? SnmpVersion { get; set; }
    public int SnmpPort { get; set; }
    public string? Rack { get; set; }
    public int? RackUnit { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public long? UptimeSeconds { get; set; }
    public decimal? CpuUsagePct { get; set; }
    public decimal? MemoryUsagePct { get; set; }
    public decimal? TemperatureC { get; set; }
    public List<PonPortDto> PonPorts { get; set; } = new();
}

public class PonPortDto
{
    public Guid Id { get; set; }
    public int Slot { get; set; }
    public int Port { get; set; }
    public string Technology { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class CreateOltDto
{
    public string Name { get; set; } = string.Empty;
    public string? Hostname { get; set; }
    public string Vendor { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? SerialNumber { get; set; }
    public string? AssetTag { get; set; }
    public string? Role { get; set; }
    public string? Environment { get; set; }
    public string? Status { get; set; }
    public string ManagementIp { get; set; } = string.Empty;
    public int? ManagementVlan { get; set; }
    public string? LoopbackIp { get; set; }
    public string? MgmtInterface { get; set; }
    public bool SshEnabled { get; set; } = true;
    public int SshPort { get; set; } = 22;
    public string? SshUsername { get; set; }
    public string? SnmpVersion { get; set; }
    public int SnmpPort { get; set; } = 161;
    public string? SiteName { get; set; }
    public string? Rack { get; set; }
    public int? RackUnit { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public class UpdateOltDto : CreateOltDto
{
}
