using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using System.Text.Json;

namespace Backend.Controllers;

[ApiController]
[Route("api/table-preferences")]
public class TablePreferenceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly MasterDbContext _masterContext;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TablePreferenceController(ApplicationDbContext context, MasterDbContext masterContext, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _masterContext = masterContext;
        _httpContextAccessor = httpContextAccessor;
    }

    private async Task<int> GetCurrentUserIdAsync()
    {
        // Get email from claims
        var email = _httpContextAccessor.HttpContext?.User?.FindFirst("email")?.Value;
        
        // Fallback to name claim
        if (string.IsNullOrEmpty(email))
        {
            email = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
        }
        
        if (string.IsNullOrEmpty(email))
        {
            throw new UnauthorizedAccessException("User email not found in claims");
        }
        
        // Get user ID from database
        var user = await _masterContext.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
        {
            throw new UnauthorizedAccessException("User not found in database");
        }
        
        return user.Id;
    }

    [HttpGet("{tableName}")]
    public async Task<ActionResult<TablePreference>> GetPreference(string tableName)
    {
        var userId = await GetCurrentUserIdAsync();

        var preference = await _context.TablePreferences
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TableName == tableName);

        if (preference == null)
        {
            return NotFound();
        }

        return Ok(preference);
    }

    [HttpPost]
    public async Task<ActionResult<TablePreference>> SavePreference([FromBody] TablePreferenceDto dto)
    {
        var userId = await GetCurrentUserIdAsync();

        var existing = await _context.TablePreferences
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TableName == dto.TableName);

        if (existing != null)
        {
            // Update existing preference
            existing.ColumnWidths = dto.ColumnWidths;
            existing.ColumnOrder = dto.ColumnOrder;
            existing.ColumnVisibility = dto.ColumnVisibility;
            existing.SortField = dto.SortField;
            existing.SortDirection = dto.SortDirection;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(existing);
        }
        else
        {
            // Create new preference
            var preference = new TablePreference
            {
                UserId = userId,
                TableName = dto.TableName,
                ColumnWidths = dto.ColumnWidths,
                ColumnOrder = dto.ColumnOrder,
                ColumnVisibility = dto.ColumnVisibility,
                SortField = dto.SortField,
                SortDirection = dto.SortDirection,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.TablePreferences.Add(preference);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPreference), new { tableName = preference.TableName }, preference);
        }
    }

    [HttpDelete("{tableName}")]
    public async Task<IActionResult> DeletePreference(string tableName)
    {
        var userId = await GetCurrentUserIdAsync();

        var preference = await _context.TablePreferences
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TableName == tableName);

        if (preference == null)
        {
            return NotFound();
        }

        _context.TablePreferences.Remove(preference);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class TablePreferenceDto
{
    public string TableName { get; set; } = string.Empty;
    public string? ColumnWidths { get; set; }
    public string? ColumnOrder { get; set; }
    public string? ColumnVisibility { get; set; }
    public string? SortField { get; set; }
    public string? SortDirection { get; set; }
}
