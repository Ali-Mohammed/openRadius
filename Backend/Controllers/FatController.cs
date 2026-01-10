using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text;
using ClosedXML.Excel;

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
    public async Task<ActionResult<PaginatedResponse<FatDto>>> GetFats(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            var query = _context.Fats
                .Where(f => !f.IsDeleted)
                .Include(f => f.Fdt)
                .ThenInclude(fd => fd!.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.FatPorts.Where(fp => !fp.IsDeleted))
                .AsQueryable();

            // Apply search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(f =>
                    f.Code.ToLower().Contains(search) ||
                    (f.Name != null && f.Name.ToLower().Contains(search)) ||
                    (f.Address != null && f.Address.ToLower().Contains(search)) ||
                    f.Fdt!.Code.ToLower().Contains(search) ||
                    f.Fdt.PonPort!.Olt!.Name.ToLower().Contains(search)
                );
            }

            // Apply sorting
            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("code", "desc") => query.OrderByDescending(f => f.Code),
                ("code", _) => query.OrderBy(f => f.Code),
                ("name", "desc") => query.OrderByDescending(f => f.Name),
                ("name", _) => query.OrderBy(f => f.Name),
                ("capacity", "desc") => query.OrderByDescending(f => f.Capacity),
                ("capacity", _) => query.OrderBy(f => f.Capacity),
                ("status", "desc") => query.OrderByDescending(f => f.Status),
                ("status", _) => query.OrderBy(f => f.Status),
                ("createdat", "desc") => query.OrderByDescending(f => f.CreatedAt),
                ("createdat", _) => query.OrderBy(f => f.CreatedAt),
                _ => query.OrderBy(f => f.Code)
            };

            var totalRecords = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

            var fats = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(f => new FatDto
                {
                    Id = f.Id,
                    Code = f.Code,
                    Name = f.Name,
                    Capacity = f.Capacity,
                    UsedPorts = f.UsedPorts,
                    Status = f.Status,
                    Address = f.Address,
                    FdtCode = f.Fdt!.Code,
                    OltName = f.Fdt.PonPort!.Olt!.Name,
                    PortCount = f.FatPorts.Count,
                    Latitude = f.Latitude,
                    Longitude = f.Longitude,
                    CreatedAt = f.CreatedAt,
                    UpdatedAt = f.UpdatedAt
                })
                .ToListAsync();

            var response = new PaginatedResponse<FatDto>
            {
                Data = fats,
                Pagination = new PaginationInfo
                {
                    CurrentPage = page,
                    PageSize = pageSize,
                    TotalRecords = totalRecords,
                    TotalPages = totalPages
                }
            };

            return Ok(response);
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
                Capacity = fat.Capacity,
                UsedPorts = fat.UsedPorts,
                CoverageRadiusM = fat.CoverageRadiusM,
                Installation = fat.Installation,
                Status = fat.Status,
                Address = fat.Address,
                Latitude = fat.Latitude,
                Longitude = fat.Longitude,
                LastInspectionAt = fat.LastInspectionAt,
                Notes = fat.Notes,
                FdtCode = fat.Fdt!.Code,
                FdtName = fat.Fdt.Name,
                OltName = fat.Fdt.PonPort!.Olt!.Name,
                Ports = fat.FatPorts.Select(fp => new FatPortDto
                {
                    Id = fp.Id,
                    PortNumber = fp.PortNumber,
                    Status = fp.Status,
                    SubscriberId = fp.SubscriberId
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
                Capacity = dto.Capacity,
                CoverageRadiusM = dto.CoverageRadiusM,
                Installation = dto.Installation,
                Status = dto.Status ?? "active",
                Address = dto.Address,
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
            fat.Capacity = dto.Capacity;
            fat.CoverageRadiusM = dto.CoverageRadiusM;
            fat.Installation = dto.Installation;
            fat.Status = dto.Status;
            fat.Address = dto.Address;
            fat.Latitude = dto.Latitude;
            fat.Longitude = dto.Longitude;
            fat.LastInspectionAt = dto.LastInspectionAt;
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

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreFat(Guid id)
    {
        try
        {
            var fat = await _context.Fats.FirstOrDefaultAsync(f => f.Id == id && f.IsDeleted);
            if (fat == null)
                return NotFound(new { message = "FAT not found in trash" });

            fat.IsDeleted = false;
            fat.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "FAT restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring FAT {Id}", id);
            return StatusCode(500, new { message = "Failed to restore FAT", error = ex.Message });
        }
    }

    [HttpGet("trash")]
    public async Task<ActionResult<PaginatedResponse<FatDto>>> GetTrash(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var query = _context.Fats
                .Where(f => f.IsDeleted)
                .Include(f => f.Fdt)
                .ThenInclude(fd => fd!.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.FatPorts.Where(fp => !fp.IsDeleted));

            var totalRecords = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

            var fats = await query
                .OrderByDescending(f => f.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(f => new FatDto
                {
                    Id = f.Id,
                    Code = f.Code,
                    Name = f.Name,
                    Capacity = f.Capacity,
                    UsedPorts = f.UsedPorts,
                    Status = f.Status,
                    Address = f.Address,
                    FdtCode = f.Fdt!.Code,
                    OltName = f.Fdt.PonPort!.Olt!.Name,
                    PortCount = f.FatPorts.Count,
                    Latitude = f.Latitude,
                    Longitude = f.Longitude,
                    CreatedAt = f.CreatedAt,
                    UpdatedAt = f.UpdatedAt
                })
                .ToListAsync();

            var response = new PaginatedResponse<FatDto>
            {
                Data = fats,
                Pagination = new PaginationInfo
                {
                    CurrentPage = page,
                    PageSize = pageSize,
                    TotalRecords = totalRecords,
                    TotalPages = totalPages
                }
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting deleted FATs");
            return StatusCode(500, new { message = "Failed to retrieve deleted FATs", error = ex.Message });
        }
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportToCsv(
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            var query = _context.Fats
                .Where(f => !f.IsDeleted)
                .Include(f => f.Fdt)
                .ThenInclude(fd => fd!.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.FatPorts.Where(fp => !fp.IsDeleted))
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(f =>
                    f.Code.ToLower().Contains(search) ||
                    (f.Name != null && f.Name.ToLower().Contains(search)) ||
                    (f.Address != null && f.Address.ToLower().Contains(search)) ||
                    f.Fdt!.Code.ToLower().Contains(search) ||
                    f.Fdt.PonPort!.Olt!.Name.ToLower().Contains(search)
                );
            }

            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("code", "desc") => query.OrderByDescending(f => f.Code),
                ("code", _) => query.OrderBy(f => f.Code),
                ("name", "desc") => query.OrderByDescending(f => f.Name),
                ("name", _) => query.OrderBy(f => f.Name),
                _ => query.OrderBy(f => f.Code)
            };

            var fats = await query.ToListAsync();

            var csv = new StringBuilder();
            csv.AppendLine("Code,Name,Address,Capacity,Used Ports,Status,FDT Code,OLT Name,Port Count,Latitude,Longitude,Created At,Updated At");

            foreach (var fat in fats)
            {
                csv.AppendLine($"\"{fat.Code}\",\"{fat.Name}\",\"{fat.Address}\",{fat.Capacity},{fat.UsedPorts},\"{fat.Status}\",\"{fat.Fdt!.Code}\",\"{fat.Fdt.PonPort!.Olt!.Name}\",{fat.FatPorts.Count},\"{fat.Latitude}\",\"{fat.Longitude}\",\"{fat.CreatedAt:yyyy-MM-dd HH:mm:ss}\",\"{fat.UpdatedAt:yyyy-MM-dd HH:mm:ss}\"");
            }

            var bytes = Encoding.UTF8.GetBytes(csv.ToString());
            return File(bytes, "text/csv", $"fats_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting FATs to CSV");
            return StatusCode(500, new { message = "Failed to export FATs", error = ex.Message });
        }
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportToExcel(
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            var query = _context.Fats
                .Where(f => !f.IsDeleted)
                .Include(f => f.Fdt)
                .ThenInclude(fd => fd!.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.FatPorts.Where(fp => !fp.IsDeleted))
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(f =>
                    f.Code.ToLower().Contains(search) ||
                    (f.Name != null && f.Name.ToLower().Contains(search)) ||
                    (f.Address != null && f.Address.ToLower().Contains(search)) ||
                    f.Fdt!.Code.ToLower().Contains(search) ||
                    f.Fdt.PonPort!.Olt!.Name.ToLower().Contains(search)
                );
            }

            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("code", "desc") => query.OrderByDescending(f => f.Code),
                ("code", _) => query.OrderBy(f => f.Code),
                ("name", "desc") => query.OrderByDescending(f => f.Name),
                ("name", _) => query.OrderBy(f => f.Name),
                _ => query.OrderBy(f => f.Code)
            };

            var fats = await query.ToListAsync();

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("FATs");

            // Headers
            worksheet.Cell(1, 1).Value = "Code";
            worksheet.Cell(1, 2).Value = "Name";
            worksheet.Cell(1, 3).Value = "Address";
            worksheet.Cell(1, 4).Value = "Capacity";
            worksheet.Cell(1, 5).Value = "Used Ports";
            worksheet.Cell(1, 6).Value = "Status";
            worksheet.Cell(1, 7).Value = "FDT Code";
            worksheet.Cell(1, 8).Value = "OLT Name";
            worksheet.Cell(1, 9).Value = "Port Count";
            worksheet.Cell(1, 10).Value = "Latitude";
            worksheet.Cell(1, 11).Value = "Longitude";
            worksheet.Cell(1, 12).Value = "Created At";
            worksheet.Cell(1, 13).Value = "Updated At";

            // Style headers
            var headerRange = worksheet.Range(1, 1, 1, 13);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

            // Data
            int row = 2;
            foreach (var fat in fats)
            {
                worksheet.Cell(row, 1).Value = fat.Code;
                worksheet.Cell(row, 2).Value = fat.Name ?? "";
                worksheet.Cell(row, 3).Value = fat.Address ?? "";
                worksheet.Cell(row, 4).Value = fat.Capacity;
                worksheet.Cell(row, 5).Value = fat.UsedPorts;
                worksheet.Cell(row, 6).Value = fat.Status;
                worksheet.Cell(row, 7).Value = fat.Fdt!.Code;
                worksheet.Cell(row, 8).Value = fat.Fdt.PonPort!.Olt!.Name;
                worksheet.Cell(row, 9).Value = fat.FatPorts.Count;
                worksheet.Cell(row, 10).Value = fat.Latitude?.ToString() ?? "";
                worksheet.Cell(row, 11).Value = fat.Longitude?.ToString() ?? "";
                worksheet.Cell(row, 12).Value = fat.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                worksheet.Cell(row, 13).Value = fat.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                row++;
            }

            worksheet.Columns().AdjustToContents();

            using var stream = new System.IO.MemoryStream();
            workbook.SaveAs(stream);
            var bytes = stream.ToArray();

            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"fats_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting FATs to Excel");
            return StatusCode(500, new { message = "Failed to export FATs", error = ex.Message });
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
    public string? Address { get; set; }
    public string FdtCode { get; set; } = string.Empty;
    public string OltName { get; set; } = string.Empty;
    public int PortCount { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class FatDetailDto : FatDto
{
    public Guid FdtId { get; set; }
    public int? CoverageRadiusM { get; set; }
    public string? Installation { get; set; }
    public DateTime? LastInspectionAt { get; set; }
    public string? Notes { get; set; }
    public string? FdtName { get; set; }
    public List<FatPortDto> Ports { get; set; } = new();
}

public class FatPortDto
{
    public Guid Id { get; set; }
    public int PortNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid? SubscriberId { get; set; }
}

public class CreateFatDto
{
    public string Code { get; set; } = string.Empty;
    public string? Name { get; set; }
    public Guid FdtId { get; set; }
    public int Capacity { get; set; }
    public int? CoverageRadiusM { get; set; }
    public string? Installation { get; set; }
    public string? Status { get; set; }
    public string? Address { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Notes { get; set; }
}

public class UpdateFatDto : CreateFatDto
{
    public new string Status { get; set; } = string.Empty;
    public DateTime? LastInspectionAt { get; set; }
}
