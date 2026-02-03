using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/network/olt-devices")]
[Authorize]
public class OltDeviceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<OltDeviceController> _logger;

    public OltDeviceController(
        ApplicationDbContext context,
        ILogger<OltDeviceController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/network/olt-devices
    [HttpGet]
    public async Task<ActionResult<IEnumerable<OltDeviceDto>>> GetDevices()
    {
        try
        {
            var devices = await _context.OltDevices
                .Where(d => !d.IsDeleted)
                .OrderBy(d => d.Name)
                .Select(d => new OltDeviceDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Status = d.Status,
                    CreatedAt = d.CreatedAt,
                    UpdatedAt = d.UpdatedAt
                })
                .ToListAsync();

            return Ok(devices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting OLT devices");
            return StatusCode(500, new { message = "Failed to retrieve OLT devices", error = ex.Message });
        }
    }

    // GET: api/network/olt-devices/5
    [HttpGet("{id}")]
    public async Task<ActionResult<OltDeviceDto>> GetDevice(int id)
    {
        try
        {
            var device = await _context.OltDevices
                .Where(d => d.Id == id && !d.IsDeleted)
                .Select(d => new OltDeviceDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Status = d.Status,
                    CreatedAt = d.CreatedAt,
                    UpdatedAt = d.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound(new { message = "OLT device not found" });
            }

            return Ok(device);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting OLT device {Id}", id);
            return StatusCode(500, new { message = "Failed to retrieve OLT device", error = ex.Message });
        }
    }

    // POST: api/network/olt-devices
    [HttpPost]
    public async Task<ActionResult<OltDeviceDto>> CreateDevice([FromBody] CreateOltDeviceDto dto)
    {
        try
        {
            // Validate status
            if (!IsValidStatus(dto.Status))
            {
                return BadRequest(new { message = "Invalid status. Must be 'active', 'inactive', or 'maintenance'" });
            }

            var device = new OltDevice
            {
                Name = dto.Name,
                Status = dto.Status,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.OltDevices.Add(device);
            await _context.SaveChangesAsync();

            var result = new OltDeviceDto
            {
                Id = device.Id,
                Name = device.Name,
                Status = device.Status,
                CreatedAt = device.CreatedAt,
                UpdatedAt = device.UpdatedAt
            };

            return CreatedAtAction(nameof(GetDevice), new { id = device.Id }, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating OLT device");
            return StatusCode(500, new { message = "Failed to create OLT device", error = ex.Message });
        }
    }

    // PUT: api/network/olt-devices/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] UpdateOltDeviceDto dto)
    {
        try
        {
            var device = await _context.OltDevices
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (device == null)
            {
                return NotFound(new { message = "OLT device not found" });
            }

            // Validate status
            if (!IsValidStatus(dto.Status))
            {
                return BadRequest(new { message = "Invalid status. Must be 'active', 'inactive', or 'maintenance'" });
            }

            device.Name = dto.Name;
            device.Status = dto.Status;
            device.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "OLT device updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating OLT device {Id}", id);
            return StatusCode(500, new { message = "Failed to update OLT device", error = ex.Message });
        }
    }

    // DELETE: api/network/olt-devices/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDevice(int id)
    {
        try
        {
            var device = await _context.OltDevices
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (device == null)
            {
                return NotFound(new { message = "OLT device not found" });
            }

            device.IsDeleted = true;
            device.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "OLT device deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting OLT device {Id}", id);
            return StatusCode(500, new { message = "Failed to delete OLT device", error = ex.Message });
        }
    }

    private static bool IsValidStatus(string status)
    {
        return status == "active" || status == "inactive" || status == "maintenance";
    }
}

// DTOs
public class OltDeviceDto
{
    public int Id { get; set; }
    public Guid Uuid { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateOltDeviceDto
{
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
}

public class UpdateOltDeviceDto
{
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
