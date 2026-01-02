using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Finbuckle.MultiTenant.Abstractions;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InstantController : ControllerBase
{
    private readonly MasterDbContext _masterContext;
    private readonly ILogger<InstantController> _logger;
    private readonly IConfiguration _configuration;

    public InstantController(
        MasterDbContext masterContext, 
        ILogger<InstantController> logger,
        IConfiguration configuration)
    {
        _masterContext = masterContext;
        _logger = logger;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Instant>>> GetInstants(
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortOrder = "asc",
        [FromQuery] bool includeDeleted = false)
    {
        var query = _masterContext.Instants.AsQueryable();

        // Filter out soft-deleted items by default
        if (!includeDeleted)
        {
            query = query.Where(i => i.DeletedAt == null);
        }

        // Search functionality
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(i => 
                i.Title.Contains(search) ||
                i.Name.Contains(search) ||
                i.Location.Contains(search) ||
                i.Description.Contains(search));
        }

        // Sorting
        if (!string.IsNullOrWhiteSpace(sortBy))
        {
            query = sortBy.ToLower() switch
            {
                "title" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Title) 
                    : query.OrderBy(i => i.Title),
                "name" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Name) 
                    : query.OrderBy(i => i.Name),
                "location" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Location) 
                    : query.OrderBy(i => i.Location),
                "status" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.Status) 
                    : query.OrderBy(i => i.Status),
                "createdat" => sortOrder?.ToLower() == "desc" 
                    ? query.OrderByDescending(i => i.CreatedAt) 
                    : query.OrderBy(i => i.CreatedAt),
                _ => query.OrderByDescending(i => i.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(i => i.CreatedAt);
        }

        return await query.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Instant>> GetInstant(int id)
    {
        var instant = await _masterContext.Instants.FindAsync(id);

        if (instant == null)
        {
            return NotFound();
        }

        return instant;
    }

    [HttpPost]
    public async Task<ActionResult<Instant>> CreateInstant(InstantDto dto)
    {
        var userName = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value ?? "Unknown";
        
        var instant = new Instant
        {
            Title = dto.Title,
            Name = dto.Name,
            Location = dto.Location,
            Description = dto.Description,
            Comments = dto.Comments,
            Status = dto.Status,
            Color = dto.Color,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CreatedBy = userName,
            UpdatedBy = userName
        };
        
        _masterContext.Instants.Add(instant);
        await _masterContext.SaveChangesAsync();

        // Create a dedicated database for this instant/tenant
        try
        {
            var tenantConnectionString = GetTenantConnectionString(instant.Id);
            
            var tenantInfo = new InstantTenantInfo
            {
                Id = instant.Id.ToString(),
                Identifier = instant.Name,
                Name = instant.Title,
                ConnectionString = tenantConnectionString,
                InstantId = instant.Id,
                DisplayName = instant.Title,
                Location = instant.Location,
                IsActive = instant.Status == "active"
            };
            
            var tenantDbContextOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(tenantInfo.ConnectionString)
                .Options;
                
            using var tenantContext = new ApplicationDbContext(tenantDbContextOptions);
            await tenantContext.Database.MigrateAsync();
            
            _logger.LogInformation($"✓ Created tenant database for instant: {instant.Title} (ID: {instant.Id})");
        }
        catch (Exception ex)
        {
            _logger.LogError($"✗ Failed to create tenant database for instant {instant.Title}: {ex.Message}");
            
            // Optionally rollback the instant creation
            _masterContext.Instants.Remove(instant);
            await _masterContext.SaveChangesAsync();
            
            return StatusCode(500, new { message = "Failed to create tenant database", error = ex.Message });
        }

        return CreatedAtAction(nameof(GetInstant), new { id = instant.Id }, instant);
    }

    private string GetTenantConnectionString(int instantId)
    {
        var baseConnectionString = _configuration.GetConnectionString("DefaultConnection") ?? string.Empty;
        var parts = baseConnectionString.Split(';');
        var newParts = new List<string>();
        
        foreach (var part in parts)
        {
            if (part.Trim().StartsWith("Database=", StringComparison.OrdinalIgnoreCase))
            {
                newParts.Add($"Database=openradius_instant_{instantId}");
            }
            else
            {
                newParts.Add(part);
            }
        }
        
        return string.Join(";", newParts);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateInstant(int id, InstantDto dto)
    {
        var instant = await _masterContext.Instants.FindAsync(id);
        if (instant == null || instant.DeletedAt != null)
        {
            return NotFound();
        }

        var userName = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value ?? "Unknown";
        
        instant.Title = dto.Title;
        instant.Name = dto.Name;
        instant.Location = dto.Location;
        instant.Description = dto.Description;
        instant.Comments = dto.Comments;
        instant.Status = dto.Status;
        instant.Color = dto.Color;
        instant.UpdatedAt = DateTime.UtcNow;
        instant.UpdatedBy = userName;

        try
        {
            await _masterContext.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!InstantExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteInstant(int id)
    {
        var instant = await _masterContext.Instants.FindAsync(id);
        if (instant == null || instant.DeletedAt != null)
        {
            return NotFound();
        }

        var userName = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value ?? "Unknown";
        
        instant.DeletedAt = DateTime.UtcNow;
        instant.DeletedBy = userName;
        await _masterContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreInstant(int id)
    {
        var instant = await _masterContext.Instants.FindAsync(id);
        if (instant == null)
        {
            return NotFound();
        }

        if (instant.DeletedAt == null)
        {
            return BadRequest("Instant is not deleted");
        }

        instant.DeletedAt = null;
        instant.DeletedBy = null;
        instant.UpdatedAt = DateTime.UtcNow;
        instant.UpdatedBy = User.Identity?.Name ?? User.FindFirst("preferred_username")?.Value ?? "Unknown";
        await _masterContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("deleted")]
    public async Task<ActionResult<IEnumerable<Instant>>> GetDeletedInstants()
    {
        var query = _masterContext.Instants
            .Where(i => i.DeletedAt != null)
            .OrderByDescending(i => i.DeletedAt);

        return await query.ToListAsync();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportToExcel()
    {
        var instants = await _masterContext.Instants.OrderByDescending(i => i.CreatedAt).ToListAsync();
        
        using var workbook = new ClosedXML.Excel.XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Instants");
        
        // Headers
        worksheet.Cell(1, 1).Value = "ID";
        worksheet.Cell(1, 2).Value = "Title";
        worksheet.Cell(1, 3).Value = "Name";
        worksheet.Cell(1, 4).Value = "Location";
        worksheet.Cell(1, 5).Value = "Description";
        worksheet.Cell(1, 6).Value = "Comments";
        worksheet.Cell(1, 7).Value = "Status";
        worksheet.Cell(1, 8).Value = "Color";
        worksheet.Cell(1, 9).Value = "Created At";
        worksheet.Cell(1, 10).Value = "Created By";
        worksheet.Cell(1, 11).Value = "Updated At";
        worksheet.Cell(1, 12).Value = "Updated By";
        worksheet.Cell(1, 13).Value = "Deleted At";
        worksheet.Cell(1, 14).Value = "Deleted By";
        
        // Style headers
        var headerRange = worksheet.Range(1, 1, 1, 14);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.LightGray;
        
        // Data
        for (int i = 0; i < instants.Count; i++)
        {
            var instant = instants[i];
            var row = i + 2;
            
            worksheet.Cell(row, 1).Value = instant.Id;
            worksheet.Cell(row, 2).Value = instant.Title;
            worksheet.Cell(row, 3).Value = instant.Name;
            worksheet.Cell(row, 4).Value = instant.Location;
            worksheet.Cell(row, 5).Value = instant.Description;
            worksheet.Cell(row, 6).Value = instant.Comments;
            worksheet.Cell(row, 7).Value = instant.Status;
            worksheet.Cell(row, 8).Value = instant.Color;
            worksheet.Cell(row, 9).Value = instant.CreatedAt;
            worksheet.Cell(row, 10).Value = instant.CreatedBy;
            worksheet.Cell(row, 11).Value = instant.UpdatedAt;
            worksheet.Cell(row, 12).Value = instant.UpdatedBy;
            worksheet.Cell(row, 13).Value = instant.DeletedAt?.ToString() ?? "";
            worksheet.Cell(row, 14).Value = instant.DeletedBy ?? "";
        }
        
        // Auto-fit columns
        worksheet.Columns().AdjustToContents();
        
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        
        return File(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"instants_{DateTime.UtcNow:yyyy-MM-dd}.xlsx"
        );
    }

    private bool InstantExists(int id)
    {
        return _masterContext.Instants.Any(e => e.Id == id);
    }
}
