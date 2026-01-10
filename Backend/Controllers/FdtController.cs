using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text;
using ClosedXML.Excel;

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
    public async Task<ActionResult<PaginatedResponse<FdtDto>>> GetFdts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            var query = _context.Fdts
                .Where(f => !f.IsDeleted)
                .Include(f => f.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.Fats.Where(fa => !fa.IsDeleted))
                .AsQueryable();

            // Apply search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(f =>
                    f.Code.ToLower().Contains(search) ||
                    (f.Name != null && f.Name.ToLower().Contains(search)) ||
                    (f.Zone != null && f.Zone.ToLower().Contains(search)) ||
                    (f.Address != null && f.Address.ToLower().Contains(search)) ||
                    f.PonPort!.Olt!.Name.ToLower().Contains(search)
                );
            }

            // Apply sorting
            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("code", "desc") => query.OrderByDescending(f => f.Code),
                ("code", _) => query.OrderBy(f => f.Code),
                ("name", "desc") => query.OrderByDescending(f => f.Name),
                ("name", _) => query.OrderBy(f => f.Name),
                ("zone", "desc") => query.OrderByDescending(f => f.Zone),
                ("zone", _) => query.OrderBy(f => f.Zone),
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

            var fdts = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(f => new FdtDto
                {
                    Id = f.Id,
                    Code = f.Code,
                    Name = f.Name,
                    Capacity = f.Capacity,
                    UsedPorts = f.UsedPorts,
                    Status = f.Status,
                    Zone = f.Zone,
                    Address = f.Address,
                    OltName = f.PonPort!.Olt!.Name,
                    PonPortSlot = f.PonPort.Slot,
                    PonPortPort = f.PonPort.Port,
                    FatCount = f.Fats.Count,
                    Latitude = f.Latitude,
                    Longitude = f.Longitude,
                    CreatedAt = f.CreatedAt,
                    UpdatedAt = f.UpdatedAt
                })
                .ToListAsync();

            var response = new PaginatedResponse<FdtDto>
            {
                Data = fdts,
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

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreFdt(Guid id)
    {
        try
        {
            var fdt = await _context.Fdts.FirstOrDefaultAsync(f => f.Id == id && f.IsDeleted);
            if (fdt == null)
                return NotFound(new { message = "FDT not found in trash" });

            fdt.IsDeleted = false;
            fdt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "FDT restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring FDT {Id}", id);
            return StatusCode(500, new { message = "Failed to restore FDT", error = ex.Message });
        }
    }

    [HttpGet("trash")]
    public async Task<ActionResult<PaginatedResponse<FdtDto>>> GetTrash(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var query = _context.Fdts
                .Where(f => f.IsDeleted)
                .Include(f => f.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.Fats.Where(fa => !fa.IsDeleted));

            var totalRecords = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

            var fdts = await query
                .OrderByDescending(f => f.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(f => new FdtDto
                {
                    Id = f.Id,
                    Code = f.Code,
                    Name = f.Name,
                    Capacity = f.Capacity,
                    UsedPorts = f.UsedPorts,
                    Status = f.Status,
                    Zone = f.Zone,
                    Address = f.Address,
                    OltName = f.PonPort!.Olt!.Name,
                    PonPortSlot = f.PonPort.Slot,
                    PonPortPort = f.PonPort.Port,
                    FatCount = f.Fats.Count,
                    Latitude = f.Latitude,
                    Longitude = f.Longitude,
                    CreatedAt = f.CreatedAt,
                    UpdatedAt = f.UpdatedAt
                })
                .ToListAsync();

            var response = new PaginatedResponse<FdtDto>
            {
                Data = fdts,
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
            _logger.LogError(ex, "Error getting deleted FDTs");
            return StatusCode(500, new { message = "Failed to retrieve deleted FDTs", error = ex.Message });
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
            var query = _context.Fdts
                .Where(f => !f.IsDeleted)
                .Include(f => f.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.Fats.Where(fa => !fa.IsDeleted))
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(f =>
                    f.Code.ToLower().Contains(search) ||
                    (f.Name != null && f.Name.ToLower().Contains(search)) ||
                    (f.Zone != null && f.Zone.ToLower().Contains(search)) ||
                    (f.Address != null && f.Address.ToLower().Contains(search)) ||
                    f.PonPort!.Olt!.Name.ToLower().Contains(search)
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

            var fdts = await query.ToListAsync();

            var csv = new StringBuilder();
            csv.AppendLine("Code,Name,Zone,Address,Capacity,Used Ports,Status,OLT Name,PON Port,FAT Count,Latitude,Longitude,Created At,Updated At");

            foreach (var fdt in fdts)
            {
                csv.AppendLine($"\"{fdt.Code}\",\"{fdt.Name}\",\"{fdt.Zone}\",\"{fdt.Address}\",{fdt.Capacity},{fdt.UsedPorts},\"{fdt.Status}\",\"{fdt.PonPort!.Olt!.Name}\",\"{fdt.PonPort.Slot}/{fdt.PonPort.Port}\",{fdt.Fats.Count},\"{fdt.Latitude}\",\"{fdt.Longitude}\",\"{fdt.CreatedAt:yyyy-MM-dd HH:mm:ss}\",\"{fdt.UpdatedAt:yyyy-MM-dd HH:mm:ss}\"");
            }

            var bytes = Encoding.UTF8.GetBytes(csv.ToString());
            return File(bytes, "text/csv", $"fdts_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting FDTs to CSV");
            return StatusCode(500, new { message = "Failed to export FDTs", error = ex.Message });
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
            var query = _context.Fdts
                .Where(f => !f.IsDeleted)
                .Include(f => f.PonPort)
                .ThenInclude(p => p!.Olt)
                .Include(f => f.Fats.Where(fa => !fa.IsDeleted))
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(f =>
                    f.Code.ToLower().Contains(search) ||
                    (f.Name != null && f.Name.ToLower().Contains(search)) ||
                    (f.Zone != null && f.Zone.ToLower().Contains(search)) ||
                    (f.Address != null && f.Address.ToLower().Contains(search)) ||
                    f.PonPort!.Olt!.Name.ToLower().Contains(search)
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

            var fdts = await query.ToListAsync();

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("FDTs");

            // Headers
            worksheet.Cell(1, 1).Value = "Code";
            worksheet.Cell(1, 2).Value = "Name";
            worksheet.Cell(1, 3).Value = "Zone";
            worksheet.Cell(1, 4).Value = "Address";
            worksheet.Cell(1, 5).Value = "Capacity";
            worksheet.Cell(1, 6).Value = "Used Ports";
            worksheet.Cell(1, 7).Value = "Status";
            worksheet.Cell(1, 8).Value = "OLT Name";
            worksheet.Cell(1, 9).Value = "PON Port";
            worksheet.Cell(1, 10).Value = "FAT Count";
            worksheet.Cell(1, 11).Value = "Latitude";
            worksheet.Cell(1, 12).Value = "Longitude";
            worksheet.Cell(1, 13).Value = "Created At";
            worksheet.Cell(1, 14).Value = "Updated At";

            // Style headers
            var headerRange = worksheet.Range(1, 1, 1, 14);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

            // Data
            int row = 2;
            foreach (var fdt in fdts)
            {
                worksheet.Cell(row, 1).Value = fdt.Code;
                worksheet.Cell(row, 2).Value = fdt.Name ?? "";
                worksheet.Cell(row, 3).Value = fdt.Zone ?? "";
                worksheet.Cell(row, 4).Value = fdt.Address ?? "";
                worksheet.Cell(row, 5).Value = fdt.Capacity;
                worksheet.Cell(row, 6).Value = fdt.UsedPorts;
                worksheet.Cell(row, 7).Value = fdt.Status;
                worksheet.Cell(row, 8).Value = fdt.PonPort!.Olt!.Name;
                worksheet.Cell(row, 9).Value = $"{fdt.PonPort.Slot}/{fdt.PonPort.Port}";
                worksheet.Cell(row, 10).Value = fdt.Fats.Count;
                worksheet.Cell(row, 11).Value = fdt.Latitude?.ToString() ?? "";
                worksheet.Cell(row, 12).Value = fdt.Longitude?.ToString() ?? "";
                worksheet.Cell(row, 13).Value = fdt.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                worksheet.Cell(row, 14).Value = fdt.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                row++;
            }

            worksheet.Columns().AdjustToContents();

            using var stream = new System.IO.MemoryStream();
            workbook.SaveAs(stream);
            var bytes = stream.ToArray();

            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"fdts_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting FDTs to Excel");
            return StatusCode(500, new { message = "Failed to export FDTs", error = ex.Message });
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
    public string? Address { get; set; }
    public string? OltName { get; set; }
    public int PonPortSlot { get; set; }
    public int PonPortPort { get; set; }
    public int FatCount { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class FdtDetailDto : FdtDto
{
    public Guid PonPortId { get; set; }
    public string? Cabinet { get; set; }
    public string? SplitRatio { get; set; }
    public DateTime? InstallationDate { get; set; }
    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }
    public string? Notes { get; set; }
    public List<FatSummaryDto> Fats { get; set; } = new();
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
    public new string Status { get; set; } = string.Empty;
    public DateTime? LastInspectionAt { get; set; }
    public DateTime? NextInspectionAt { get; set; }
}
