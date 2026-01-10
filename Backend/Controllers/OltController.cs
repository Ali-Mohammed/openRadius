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
    public async Task<ActionResult<PaginatedResponse<OltDto>>> GetOlts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            var query = _context.Olts
                .Where(o => !o.IsDeleted)
                .Include(o => o.PonPorts.Where(p => !p.IsDeleted))
                .AsQueryable();

            // Apply search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(o =>
                    o.Name.ToLower().Contains(search) ||
                    o.Vendor.ToLower().Contains(search) ||
                    o.Model.ToLower().Contains(search) ||
                    (o.ManagementIp != null && o.ManagementIp.ToLower().Contains(search)) ||
                    (o.SiteName != null && o.SiteName.ToLower().Contains(search)) ||
                    (o.SerialNumber != null && o.SerialNumber.ToLower().Contains(search))
                );
            }

            // Apply sorting
            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("name", "desc") => query.OrderByDescending(o => o.Name),
                ("name", _) => query.OrderBy(o => o.Name),
                ("vendor", "desc") => query.OrderByDescending(o => o.Vendor),
                ("vendor", _) => query.OrderBy(o => o.Vendor),
                ("model", "desc") => query.OrderByDescending(o => o.Model),
                ("model", _) => query.OrderBy(o => o.Model),
                ("managementip", "desc") => query.OrderByDescending(o => o.ManagementIp),
                ("managementip", _) => query.OrderBy(o => o.ManagementIp),
                ("sitename", "desc") => query.OrderByDescending(o => o.SiteName),
                ("sitename", _) => query.OrderBy(o => o.SiteName),
                ("status", "desc") => query.OrderByDescending(o => o.Status),
                ("status", _) => query.OrderBy(o => o.Status),
                ("createdat", "desc") => query.OrderByDescending(o => o.CreatedAt),
                ("createdat", _) => query.OrderBy(o => o.CreatedAt),
                _ => query.OrderBy(o => o.Name)
            };

            var totalRecords = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

            var olts = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(o => new OltDto
                {
                    Id = o.Id,
                    Name = o.Name,
                    Hostname = o.Hostname,
                    Vendor = o.Vendor,
                    Model = o.Model,
                    SerialNumber = o.SerialNumber,
                    AssetTag = o.AssetTag,
                    Role = o.Role,
                    ManagementIp = o.ManagementIp,
                    ManagementVlan = o.ManagementVlan,
                    LoopbackIp = o.LoopbackIp,
                    MgmtInterface = o.MgmtInterface,
                    Status = o.Status,
                    Environment = o.Environment,
                    SshEnabled = o.SshEnabled,
                    SshPort = o.SshPort,
                    SshUsername = o.SshUsername,
                    SnmpVersion = o.SnmpVersion,
                    SnmpPort = o.SnmpPort,
                    SiteName = o.SiteName,
                    Rack = o.Rack,
                    RackUnit = o.RackUnit,
                    Latitude = o.Latitude,
                    Longitude = o.Longitude,
                    PonPortCount = o.PonPorts.Count(p => !p.IsDeleted),
                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt
                })
                .ToListAsync();

            var response = new PaginatedResponse<OltDto>
            {
                Data = olts,
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
                SshPasswordRef = dto.SshPassword, // TODO: Encrypt before storing
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
            if (!string.IsNullOrEmpty(dto.SshPassword))
            {
                olt.SshPasswordRef = dto.SshPassword; // TODO: Encrypt before storing
            }
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

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreOlt(Guid id)
    {
        try
        {
            var olt = await _context.Olts.FirstOrDefaultAsync(o => o.Id == id && o.IsDeleted);
            if (olt == null)
                return NotFound(new { message = "OLT not found in trash" });

            olt.IsDeleted = false;
            olt.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "OLT restored successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring OLT {Id}", id);
            return StatusCode(500, new { message = "Failed to restore OLT", error = ex.Message });
        }
    }

    [HttpGet("trash")]
    public async Task<ActionResult<PaginatedResponse<OltDto>>> GetTrash(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var query = _context.Olts
                .Where(o => o.IsDeleted)
                .Include(o => o.PonPorts.Where(p => !p.IsDeleted));

            var totalRecords = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalRecords / (double)pageSize);

            var olts = await query
                .OrderByDescending(o => o.UpdatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(o => new OltDto
                {
                    Id = o.Id,
                    Name = o.Name,
                    Hostname = o.Hostname,
                    Vendor = o.Vendor,
                    Model = o.Model,
                    SerialNumber = o.SerialNumber,
                    AssetTag = o.AssetTag,
                    Role = o.Role,
                    ManagementIp = o.ManagementIp,
                    ManagementVlan = o.ManagementVlan,
                    LoopbackIp = o.LoopbackIp,
                    MgmtInterface = o.MgmtInterface,
                    Status = o.Status,
                    Environment = o.Environment,
                    SshEnabled = o.SshEnabled,
                    SshPort = o.SshPort,
                    SshUsername = o.SshUsername,
                    SnmpVersion = o.SnmpVersion,
                    SnmpPort = o.SnmpPort,
                    SiteName = o.SiteName,
                    Rack = o.Rack,
                    RackUnit = o.RackUnit,
                    Latitude = o.Latitude,
                    Longitude = o.Longitude,
                    PonPortCount = o.PonPorts.Count(p => !p.IsDeleted),
                    CreatedAt = o.CreatedAt,
                    UpdatedAt = o.UpdatedAt
                })
                .ToListAsync();

            var response = new PaginatedResponse<OltDto>
            {
                Data = olts,
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
            _logger.LogError(ex, "Error getting deleted OLTs");
            return StatusCode(500, new { message = "Failed to retrieve deleted OLTs", error = ex.Message });
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
            var query = _context.Olts
                .Where(o => !o.IsDeleted)
                .Include(o => o.PonPorts.Where(p => !p.IsDeleted))
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(o =>
                    o.Name.ToLower().Contains(search) ||
                    o.Vendor.ToLower().Contains(search) ||
                    o.Model.ToLower().Contains(search) ||
                    (o.ManagementIp != null && o.ManagementIp.ToLower().Contains(search)) ||
                    (o.SiteName != null && o.SiteName.ToLower().Contains(search))
                );
            }

            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("name", "desc") => query.OrderByDescending(o => o.Name),
                ("name", _) => query.OrderBy(o => o.Name),
                ("vendor", "desc") => query.OrderByDescending(o => o.Vendor),
                ("vendor", _) => query.OrderBy(o => o.Vendor),
                _ => query.OrderBy(o => o.Name)
            };

            var olts = await query.ToListAsync();

            var csv = new System.Text.StringBuilder();
            csv.AppendLine("Name,Vendor,Model,Serial Number,Management IP,Status,Environment,Site Name,PON Ports,Created At,Updated At");

            foreach (var olt in olts)
            {
                csv.AppendLine($"\"{olt.Name}\",\"{olt.Vendor}\",\"{olt.Model}\",\"{olt.SerialNumber}\",\"{olt.ManagementIp}\",\"{olt.Status}\",\"{olt.Environment}\",\"{olt.SiteName}\",{olt.PonPorts.Count(p => !p.IsDeleted)},\"{olt.CreatedAt:yyyy-MM-dd HH:mm:ss}\",\"{olt.UpdatedAt:yyyy-MM-dd HH:mm:ss}\"");
            }

            var bytes = System.Text.Encoding.UTF8.GetBytes(csv.ToString());
            return File(bytes, "text/csv", $"olts_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting OLTs to CSV");
            return StatusCode(500, new { message = "Failed to export OLTs", error = ex.Message });
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
            var query = _context.Olts
                .Where(o => !o.IsDeleted)
                .Include(o => o.PonPorts.Where(p => !p.IsDeleted))
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(o =>
                    o.Name.ToLower().Contains(search) ||
                    o.Vendor.ToLower().Contains(search) ||
                    o.Model.ToLower().Contains(search) ||
                    (o.ManagementIp != null && o.ManagementIp.ToLower().Contains(search)) ||
                    (o.SiteName != null && o.SiteName.ToLower().Contains(search))
                );
            }

            query = (sortField?.ToLower(), sortDirection?.ToLower()) switch
            {
                ("name", "desc") => query.OrderByDescending(o => o.Name),
                ("name", _) => query.OrderBy(o => o.Name),
                ("vendor", "desc") => query.OrderByDescending(o => o.Vendor),
                ("vendor", _) => query.OrderBy(o => o.Vendor),
                _ => query.OrderBy(o => o.Name)
            };

            var olts = await query.ToListAsync();

            using var workbook = new ClosedXML.Excel.XLWorkbook();
            var worksheet = workbook.Worksheets.Add("OLTs");

            // Headers
            worksheet.Cell(1, 1).Value = "Name";
            worksheet.Cell(1, 2).Value = "Vendor";
            worksheet.Cell(1, 3).Value = "Model";
            worksheet.Cell(1, 4).Value = "Serial Number";
            worksheet.Cell(1, 5).Value = "Management IP";
            worksheet.Cell(1, 6).Value = "Status";
            worksheet.Cell(1, 7).Value = "Environment";
            worksheet.Cell(1, 8).Value = "Site Name";
            worksheet.Cell(1, 9).Value = "PON Ports";
            worksheet.Cell(1, 10).Value = "Created At";
            worksheet.Cell(1, 11).Value = "Updated At";

            // Style headers
            var headerRange = worksheet.Range(1, 1, 1, 11);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;

            // Data
            int row = 2;
            foreach (var olt in olts)
            {
                worksheet.Cell(row, 1).Value = olt.Name;
                worksheet.Cell(row, 2).Value = olt.Vendor;
                worksheet.Cell(row, 3).Value = olt.Model;
                worksheet.Cell(row, 4).Value = olt.SerialNumber ?? "";
                worksheet.Cell(row, 5).Value = olt.ManagementIp;
                worksheet.Cell(row, 6).Value = olt.Status;
                worksheet.Cell(row, 7).Value = olt.Environment;
                worksheet.Cell(row, 8).Value = olt.SiteName ?? "";
                worksheet.Cell(row, 9).Value = olt.PonPorts.Count(p => !p.IsDeleted);
                worksheet.Cell(row, 10).Value = olt.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                worksheet.Cell(row, 11).Value = olt.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss");
                row++;
            }

            worksheet.Columns().AdjustToContents();

            using var stream = new System.IO.MemoryStream();
            workbook.SaveAs(stream);
            var bytes = stream.ToArray();

            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                $"olts_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exporting OLTs to Excel");
            return StatusCode(500, new { message = "Failed to export OLTs", error = ex.Message });
        }
    }

    [HttpGet("pon-ports")]
    public async Task<ActionResult<IEnumerable<PonPortListDto>>> GetPonPorts()
    {
        try
        {
            var ponPorts = await _context.PonPorts
                .Where(p => !p.IsDeleted)
                .Include(p => p.Olt)
                .Where(p => p.Olt != null && !p.Olt.IsDeleted)
                .OrderBy(p => p.Olt!.Name)
                .ThenBy(p => p.Slot)
                .ThenBy(p => p.Port)
                .Select(p => new PonPortListDto
                {
                    Id = p.Id,
                    OltId = p.OltId,
                    OltName = p.Olt!.Name,
                    Slot = p.Slot,
                    Port = p.Port,
                    Technology = p.Technology,
                    Status = p.Status,
                    Label = $"{p.Olt.Name} - {p.Slot}/{p.Port} ({p.Technology})"
                })
                .ToListAsync();

            return Ok(ponPorts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting PON ports");
            return StatusCode(500, new { message = "Failed to retrieve PON ports", error = ex.Message });
        }
    }
}

// DTOs
public class PaginatedResponse<T>
{
    public List<T> Data { get; set; } = new();
    public PaginationInfo Pagination { get; set; } = new();
}

public class PaginationInfo
{
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
    public int TotalRecords { get; set; }
    public int TotalPages { get; set; }
}

public class OltDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Hostname { get; set; }
    public string Vendor { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? SerialNumber { get; set; }
    public string? AssetTag { get; set; }
    public string? Role { get; set; }
    public string ManagementIp { get; set; } = string.Empty;
    public int? ManagementVlan { get; set; }
    public string? LoopbackIp { get; set; }
    public string? MgmtInterface { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Environment { get; set; } = string.Empty;
    public bool SshEnabled { get; set; }
    public int SshPort { get; set; }
    public string? SshUsername { get; set; }
    public string? SnmpVersion { get; set; }
    public int SnmpPort { get; set; }
    public string? SiteName { get; set; }
    public string? Rack { get; set; }
    public int? RackUnit { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public int PonPortCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class OltDetailDto : OltDto
{
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

public class PonPortListDto
{
    public Guid Id { get; set; }
    public Guid OltId { get; set; }
    public string OltName { get; set; } = string.Empty;
    public int Slot { get; set; }
    public int Port { get; set; }
    public string Technology { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
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
    public string? SshPassword { get; set; }
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
