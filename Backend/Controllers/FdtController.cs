using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/network/fdts")]
[Authorize]
public class FdtController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FdtController> _logger;

    public FdtController(ApplicationDbContext context, ILogger<FdtController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FdtDto>>> GetFdts()
    {
        try
        {
            var fdts = await _context.Fdts
                .Where(f => !f.IsDeleted)
                .Include(f => f.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.Fats.Where(fa => !fa.IsDeleted))
                .OrderBy(f => f.Code)
                .Select(f => new FdtDto
                {
                    Id = f.Id,
                    Code = f.Code,
                    Name = f.Name,
                    Capacity = f.Capacity,
                    UsedPorts = f.UsedPorts,
                    Status = f.Status,
                    Zone = f.Zone,
                    OltName = f.PonPort!.Olt!.Name,
                    PonPortSlot = f.PonPort.Slot,
                    PonPortPort = f.PonPort.Port,
                    FatCount = f.Fats.Count,
                    CreatedAt = f.CreatedAt
                })
                .ToListAsync();

            return Ok(fdts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting FDTs");
            return StatusCode(500, new { message = "Failed to retrieve FDTs", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<FdtDetailDto>> GetFdt(Guid id)
    {
        try
        {
            var fdt = await _context.Fdts
                .Where(f => f.Id == id && !f.IsDeleted)
                .Include(f => f.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.Fats.Where(fa => !fa.IsDeleted))
                .FirstOrDefaultAsync();

            if (fdt == null)
                return NotFound(new { message = "FDT not found" });

            var dto = new FdtDetailDto
            {
                Id = fdt.Id,
                Code = fdt.Code,
                Name = fdt.Name,
                PonPortId = fdt.PonPortId,
                Cabinet = fdt.Cabinet,
                Capacity = fdt.Capacity,
                UsedPorts = fdt.UsedPorts,
                SplitRatio = fdt.SplitRatio,
                InstallationDate = fdt.InstallationDate,
                Status = fdt.Status,
                Address = fdt.Address,
                Zone = fdt.Zone,
                Latitude = fdt.Latitude,
                Longitude = fdt.Longitude,
                LastInspectionAt = fdt.LastInspectionAt,
                NextInspectionAt = fdt.NextInspectionAt,
                Notes = fdt.Notes,
                OltName = fdt.PonPort!.Olt!.Name,
                PonPortSlot = fdt.PonPort.Slot,
                PonPortPort = fdt.PonPort.Port,
                Fats = fdt.Fats.Select(fa => new FatSummaryDto
                {
                    Id = fa.Id,
                    Code = fa.Code,
                    Name = fa.Name,
                    Capacity = fa.Capacity,
                    UsedPorts = fa.UsedPorts,
                    Status = fa.Status
                }).ToList(),
                CreatedAt = fdt.CreatedAt,
                UpdatedAt = fdt.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting FDT {Id}", id);
            return StatusCode(500, new { message = "Failed to retrieve FDT", error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<FdtDto>> CreateFdt([FromBody] CreateFdtDto dto)
    {
        try
        {
            var fdt = new Fdt
            {
                Code = dto.Code,
                Name = dto.Name,
                PonPortId = dto.PonPortId,
                Cabinet = dto.Cabinet,
                Capacity = dto.Capacity,
                SplitRatio = dto.SplitRatio,
                InstallationDate = dto.InstallationDate,
                Status = dto.Status ?? "active",
                Address = dto.Address,
                Zone = dto.Zone,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Notes = dto.Notes
            };

            _context.Fdts.Add(fdt);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetFdt), new { id = fdt.Id }, new FdtDto
            {
                Id = fdt.Id,
                Code = fdt.Code,
                Name = fdt.Name,
                Capacity = fdt.Capacity,
                Status = fdt.Status
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating FDT");
            return StatusCode(500, new { message = "Failed to create FDT", error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateFdt(Guid id, [FromBody] UpdateFdtDto dto)
    {
        try
        {
            var fdt = await _context.Fdts.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);
            if (fdt == null)
                return NotFound(new { message = "FDT not found" });

            fdt.Code = dto.Code;
            fdt.Name = dto.Name;
            fdt.PonPortId = dto.PonPortId;
            fdt.Cabinet = dto.Cabinet;
            fdt.Capacity = dto.Capacity;
            fdt.SplitRatio = dto.SplitRatio;
            fdt.InstallationDate = dto.InstallationDate;
            fdt.Status = dto.Status;
            fdt.Address = dto.Address;
            fdt.Zone = dto.Zone;
            fdt.Latitude = dto.Latitude;
            fdt.Longitude = dto.Longitude;
            fdt.LastInspectionAt = dto.LastInspectionAt;
            fdt.NextInspectionAt = dto.NextInspectionAt;
            fdt.Notes = dto.Notes;
            fdt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "FDT updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating FDT {Id}", id);
            return StatusCode(500, new { message = "Failed to update FDT", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteFdt(Guid id)
    {
        try
        {
            var fdt = await _context.Fdts.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);
            if (fdt == null)
                return NotFound(new { message = "FDT not found" });

            fdt.IsDeleted = true;
            fdt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "FDT deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting FDT {Id}", id);
            return StatusCode(500, new { message = "Failed to delete FDT", error = ex.Message });
        }
    }
}

// FDT DTOs
public class FdtDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int Capacity { get; set; }
    public int UsedPorts { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Zone { get; set; }
    public string? OltName { get; set; }
    public int PonPortSlot { get; set; }
    public int PonPortPort { get; set; }
    public int FatCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FdtDetailDto : FdtDto
{
    public Guid PonPortId { get; set; }
    public string? Cabinet { get; set; }
    public string? SplitRatio { get; set; }
    public DateTime? InstallationDate { get; set; }
    public string? Address { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }
    public string? Notes { get; set; }
    public List<FatSummaryDto> Fats { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

public class FatSummaryDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int Capacity { get; set; }
    public int UsedPorts { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class CreateFdtDto
{
    public string Code { get; set; } = string.Empty;
    public string? Name { get; set; }
    public Guid PonPortId { get; set; }
    public string? Cabinet { get; set; }
    public int Capacity { get; set; }
    public string? SplitRatio { get; set; }
    public DateTime? InstallationDate { get; set; }
    public string? Status { get; set; }
    public string? Address { get; set; }
    public string? Zone { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Notes { get; set; }
}

public class UpdateFdtDto : CreateFdtDto
{
    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }
}
