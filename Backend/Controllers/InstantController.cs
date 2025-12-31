using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InstantController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<InstantController> _logger;

    public InstantController(ApplicationDbContext context, ILogger<InstantController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Instant>>> GetInstants(
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortOrder = "asc")
    {
        var query = _context.Instants.AsQueryable();

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
        var instant = await _context.Instants.FindAsync(id);

        if (instant == null)
        {
            return NotFound();
        }

        return instant;
    }

    [HttpPost]
    public async Task<ActionResult<Instant>> CreateInstant(Instant instant)
    {
        instant.CreatedAt = DateTime.UtcNow;
        instant.UpdatedAt = DateTime.UtcNow;
        
        _context.Instants.Add(instant);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetInstant), new { id = instant.Id }, instant);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateInstant(int id, Instant instant)
    {
        if (id != instant.Id)
        {
            return BadRequest();
        }

        instant.UpdatedAt = DateTime.UtcNow;
        _context.Entry(instant).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
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
        var instant = await _context.Instants.FindAsync(id);
        if (instant == null)
        {
            return NotFound();
        }

        _context.Instants.Remove(instant);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportToExcel()
    {
        var instants = await _context.Instants.OrderByDescending(i => i.CreatedAt).ToListAsync();
        
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
        worksheet.Cell(1, 10).Value = "Updated At";
        
        // Style headers
        var headerRange = worksheet.Range(1, 1, 1, 10);
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
            worksheet.Cell(row, 10).Value = instant.UpdatedAt;
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
        return _context.Instants.Any(e => e.Id == id);
    }
}
