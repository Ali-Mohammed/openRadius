using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/network/fats")]
[Authorize]
public class FatController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FatController> _logger;

    public FatController(ApplicationDbContext context, ILogger<FatController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FatDto>>> GetFats()
    {
        try
        {
            var fats = await _context.Fats
                .Where(f => !f.IsDeleted)
                .Include(f => f.Fdt)
                .ThenInclude(fd => fd!.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.FatPorts.Where(fp => !fp.IsDeleted))
                .OrderBy(f => f.Code)
                .Select(f => new FatDto
                {
                    Id = f.Id,
                    Code = f.Code,
                    Name = f.Name,
                    Capacity = f.Capacity,
                    UsedPorts = f.UsedPorts,
                    Status = f.Status,
                    Zone = f.Zone,
                    FdtCode = f.Fdt!.Code,
                    OltName = f.Fdt.PonPort!.Olt!.Name,
                    PortCount = f.FatPorts.Count,
                    CreatedAt = f.CreatedAt
                })
                .ToListAsync();

            return Ok(fats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting FATs");
            return StatusCode(500, new { message = "Failed to retrieve FATs", error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<FatDetailDto>> GetFat(Guid id)
    {
        try
        {
            var fat = await _context.Fats
                .Where(f => f.Id == id && !f.IsDeleted)
                .Include(f => f.Fdt)
                .ThenInclude(fd => fd!.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.FatPorts.Where(fp => !fp.IsDeleted))
                .FirstOrDefaultAsync();

            if (fat == null)
                return NotFound(new { message = "FAT not found" });

            var dto = new FatDetailDto
            {
                Id = fat.Id,
                Code = fat.Code,
                Name = fat.Name,
                FdtId = fat.FdtId,
                Pole = fat.Pole,
                Capacity = fat.Capacity,
                UsedPorts = fat.UsedPorts,
                CoverageRadiusMeters = fat.CoverageRadiusMeters,
                InstallationType = fat.InstallationType,
                InstallationDate = fat.InstallationDate,
                Status = fat.Status,
                Address = fat.Address,
                Zone = fat.Zone,
                Latitude = fat.Latitude,
                Longitude = fat.Longitude,
                LastInspectionAt = fat.LastInspectionAt,
                NextInspectionAt = fat.NextInspectionAt,
                Notes = fat.Notes,
                FdtCode = fat.Fdt!.Code,
                FdtName = fat.Fdt.Name,
                OltName = fat.Fdt.PonPort!.Olt!.Name,
                Ports = fat.FatPorts.Select(fp => new FatPortDto
                {
                    Id = fp.Id,
                    PortNumber = fp.PortNumber,
                    Status = fp.Status,
                    SubscriberName = fp.SubscriberName,
                    SubscriberPhone = fp.SubscriberPhone,
                    ActivationDate = fp.ActivationDate
                }).OrderBy(p => p.PortNumber).ToList(),
                CreatedAt = fat.CreatedAt,
                UpdatedAt = fat.UpdatedAt
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting FAT {Id}", id);
            return StatusCode(500, new { message = "Failed to retrieve FAT", error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<FatDto>> CreateFat([FromBody] CreateFatDto dto)
    {
        try
        {
            var fat = new Fat
            {
                Code = dto.Code,
                Name = dto.Name,
                FdtId = dto.FdtId,
                Pole = dto.Pole,
                Capacity = dto.Capacity,
                CoverageRadiusMeters = dto.CoverageRadiusMeters,
                InstallationType = dto.InstallationType,
                InstallationDate = dto.InstallationDate,
                Status = dto.Status ?? "active",
                Address = dto.Address,
                Zone = dto.Zone,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Notes = dto.Notes
            };

            _context.Fats.Add(fat);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetFat), new { id = fat.Id }, new FatDto
            {
                Id = fat.Id,
                Code = fat.Code,
                Name = fat.Name,
                Capacity = fat.Capacity,
                Status = fat.Status
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating FAT");
            return StatusCode(500, new { message = "Failed to create FAT", error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateFat(Guid id, [FromBody] UpdateFatDto dto)
    {
        try
        {
            var fat = await _context.Fats.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);
            if (fat == null)
                return NotFound(new { message = "FAT not found" });

            fat.Code = dto.Code;
            fat.Name = dto.Name;
            fat.FdtId = dto.FdtId;
            fat.Pole = dto.Pole;
            fat.Capacity = dto.Capacity;
            fat.CoverageRadiusMeters = dto.CoverageRadiusMeters;
            fat.InstallationType = dto.InstallationType;
            fat.InstallationDate = dto.InstallationDate;
            fat.Status = dto.Status;
            fat.Address = dto.Address;
            fat.Zone = dto.Zone;
            fat.Latitude = dto.Latitude;
            fat.Longitude = dto.Longitude;
            fat.LastInspectionAt = dto.LastInspectionAt;
            fat.NextInspectionAt = dto.NextInspectionAt;
            fat.Notes = dto.Notes;
            fat.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "FAT updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating FAT {Id}", id);
            return StatusCode(500, new { message = "Failed to update FAT", error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteFat(Guid id)
    {
        try
        {
            var fat = await _context.Fats.FirstOrDefaultAsync(f => f.Id == id && !f.IsDeleted);
            if (fat == null)
                return NotFound(new { message = "FAT not found" });

            fat.IsDeleted = true;
            fat.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "FAT deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting FAT {Id}", id);
            return StatusCode(500, new { message = "Failed to delete FAT", error = ex.Message });
        }
    }
}

// FAT DTOs
public class FatDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Name { get; set; }
    public int Capacity { get; set; }
    public int UsedPorts { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Zone { get; set; }
    public string FdtCode { get; set; } = string.Empty;
    public string OltName { get; set; } = string.Empty;
    public int PortCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FatDetailDto : FatDto
{
    public Guid FdtId { get; set; }
    public string? Pole { get; set; }
    public decimal? CoverageRadiusMeters { get; set; }
    public string? InstallationType { get; set; }
    public DateTime? InstallationDate { get; set; }
    public string? Address { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }
    public string? Notes { get; set; }
    public string? FdtName { get; set; }
    public List<FatPortDto> Ports { get; set; } = new();
    public DateTime UpdatedAt { get; set; }
}

public class FatPortDto
{
    public Guid Id { get; set; }
    public int PortNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? SubscriberName { get; set; }
    public string? SubscriberPhone { get; set; }
    public DateTime? ActivationDate { get; set; }
}

public class CreateFatDto
{
    public string Code { get; set; } = string.Empty;
    public string? Name { get; set; }
    public Guid FdtId { get; set; }
    public string? Pole { get; set; }
    public int Capacity { get; set; }
    public decimal? CoverageRadiusMeters { get; set; }
    public string? InstallationType { get; set; }
    public DateTime? InstallationDate { get; set; }
    public string? Status { get; set; }
    public string? Address { get; set; }
    public string? Zone { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Notes { get; set; }
}

public class UpdateFatDto : CreateFatDto
{
    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }
}
