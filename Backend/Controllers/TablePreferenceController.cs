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
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TablePreferenceController(ApplicationDbContext context, IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
    }

    private string GetCurrentUserId()
    {
        // Try multiple claim types in order of preference
        var claims = _httpContextAccessor.HttpContext?.User?.Claims;
        
        // First try 'sub' (standard JWT subject claim)
        var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
        
        // Fallback to 'preferred_username' (Keycloak)
        if (string.IsNullOrEmpty(userIdClaim))
        {
            userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("preferred_username")?.Value;
        }
        
        // Fallback to email
        if (string.IsNullOrEmpty(userIdClaim))
        {
            userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("email")?.Value;
        }
        
        // Fallback to name claim
        if (string.IsNullOrEmpty(userIdClaim))
        {
            userIdClaim = _httpContextAccessor.HttpContext?.User?.Identity?.Name;
        }
        
        if (string.IsNullOrEmpty(userIdClaim))
        {
            throw new UnauthorizedAccessException("User ID not found in claims");
        }
        
        return userIdClaim;
    }

    [HttpGet("{tableName}")]
    public async Task<ActionResult<TablePreference>> GetPreference(string tableName, [FromQuery] int workspaceId)
    {
        var userId = GetCurrentUserId();

        var preference = await _context.TablePreferences
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WorkspaceId == workspaceId && p.TableName == tableName);

        if (preference == null)
        {
            return NotFound();
        }

        return Ok(preference);
    }

    [HttpPost]
    public async Task<ActionResult<TablePreference>> SavePreference([FromBody] TablePreferenceDto dto)
    {
        var userId = GetCurrentUserId();

        var existing = await _context.TablePreferences
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WorkspaceId == dto.WorkspaceId && p.TableName == dto.TableName);

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
                WorkspaceId = dto.WorkspaceId,
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

            return CreatedAtAction(nameof(GetPreference), new { tableName = preference.TableName, workspaceId = preference.WorkspaceId }, preference);
        }
    }

    [HttpDelete("{tableName}")]
    public async Task<IActionResult> DeletePreference(string tableName, [FromQuery] int workspaceId)
    {
        var userId = GetCurrentUserId();

        var preference = await _context.TablePreferences
            .FirstOrDefaultAsync(p => p.UserId == userId && p.WorkspaceId == workspaceId && p.TableName == tableName);

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
    public int WorkspaceId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string? ColumnWidths { get; set; }
    public string? ColumnOrder { get; set; }
    public string? ColumnVisibility { get; set; }
    public string? SortField { get; set; }
    public string? SortDirection { get; set; }
}
