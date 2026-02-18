using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AutomationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AutomationController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AutomationController(
        ApplicationDbContext context,
        ILogger<AutomationController> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    private string? GetCurrentUserId()
    {
        return _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
    }

    // GET: api/automation
    [HttpGet]
    public async Task<ActionResult<object>> GetAutomations(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? triggerType,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] bool includeDeleted = false)
    {
        try
        {
            var query = _context.Automations.AsQueryable();

            if (!includeDeleted)
            {
                query = query.Where(a => !a.IsDeleted);
            }

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(a => 
                    a.Title.ToLower().Contains(search.ToLower()) || 
                    (a.Description != null && a.Description.ToLower().Contains(search.ToLower())));
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(a => a.Status == status);
            }

            if (!string.IsNullOrEmpty(triggerType))
            {
                query = query.Where(a => a.TriggerType == triggerType);
            }

            if (isActive.HasValue)
            {
                query = query.Where(a => a.IsActive == isActive.Value);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var automations = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                data = automations,
                totalCount,
                page,
                pageSize,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting automations");
            return StatusCode(500, new { error = "An error occurred while retrieving automations" });
        }
    }

    // GET: api/automation/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Automation>> GetAutomation(int id)
    {
        try
        {
            var automation = await _context.Automations
                .FirstOrDefaultAsync(a => a.Id == id);

            if (automation == null)
            {
                return NotFound(new { error = "Automation not found" });
            }

            return Ok(automation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting automation {Id}", id);
            return StatusCode(500, new { error = "An error occurred while retrieving the automation" });
        }
    }

    // POST: api/automation
    [HttpPost]
    public async Task<ActionResult<Automation>> CreateAutomation(CreateAutomationRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();

            var automation = new Automation
            {
                Title = request.Title,
                Description = request.Description,
                Icon = request.Icon,
                Color = request.Color,
                Status = request.Status ?? "draft",
                IsActive = request.IsActive ?? true,
                TriggerType = request.TriggerType ?? "on_requested",
                ScheduleType = request.ScheduleType,
                CronExpression = request.CronExpression,
                ScheduleIntervalMinutes = request.ScheduleIntervalMinutes,
                ScheduledTime = request.ScheduledTime,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _context.Automations.Add(automation);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAutomation), new { id = automation.Id }, automation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating automation");
            return StatusCode(500, new { error = "An error occurred while creating the automation" });
        }
    }

    // PUT: api/automation/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<Automation>> UpdateAutomation(int id, UpdateAutomationRequest request)
    {
        try
        {
            var automation = await _context.Automations.FindAsync(id);

            if (automation == null)
            {
                return NotFound(new { error = "Automation not found" });
            }

            automation.Title = request.Title;
            automation.Description = request.Description;
            automation.Icon = request.Icon;
            automation.Color = request.Color;
            automation.Status = request.Status ?? automation.Status;
            automation.IsActive = request.IsActive ?? automation.IsActive;
            automation.TriggerType = request.TriggerType ?? automation.TriggerType;
            automation.ScheduleType = request.ScheduleType;
            automation.CronExpression = request.CronExpression;
            automation.ScheduleIntervalMinutes = request.ScheduleIntervalMinutes;
            automation.ScheduledTime = request.ScheduledTime;
            automation.WorkflowJson = request.WorkflowJson ?? automation.WorkflowJson;
            automation.UpdatedAt = DateTime.UtcNow;
            automation.UpdatedBy = User.GetSystemUserId();

            await _context.SaveChangesAsync();

            return Ok(automation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating automation {Id}", id);
            return StatusCode(500, new { error = "An error occurred while updating the automation" });
        }
    }

    // DELETE: api/automation/{id} (soft delete)
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAutomation(int id)
    {
        try
        {
            var automation = await _context.Automations.FindAsync(id);

            if (automation == null)
            {
                return NotFound(new { error = "Automation not found" });
            }

            automation.IsDeleted = true;
            automation.DeletedAt = DateTime.UtcNow;
            automation.DeletedBy = User.GetSystemUserId();

            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting automation {Id}", id);
            return StatusCode(500, new { error = "An error occurred while deleting the automation" });
        }
    }

    // POST: api/automation/{id}/restore
    [HttpPost("{id}/restore")]
    public async Task<ActionResult<Automation>> RestoreAutomation(int id)
    {
        try
        {
            var automation = await _context.Automations.FindAsync(id);

            if (automation == null)
            {
                return NotFound(new { error = "Automation not found" });
            }

            automation.IsDeleted = false;
            automation.DeletedAt = null;
            automation.DeletedBy = null;

            await _context.SaveChangesAsync();

            return Ok(automation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring automation {Id}", id);
            return StatusCode(500, new { error = "An error occurred while restoring the automation" });
        }
    }
}

// Request DTOs
public record CreateAutomationRequest(
    string Title,
    string? Description,
    string? Icon,
    string? Color,
    string? Status,
    bool? IsActive,
    string? TriggerType, // on_requested, on_action, scheduled
    string? ScheduleType, // at_time, periodic
    string? CronExpression,
    int? ScheduleIntervalMinutes,
    DateTime? ScheduledTime
);

public record UpdateAutomationRequest(
    string Title,
    string? Description,
    string? Icon,
    string? Color,
    string? Status,
    bool? IsActive,
    string? WorkflowJson,
    string? TriggerType,
    string? ScheduleType,
    string? CronExpression,
    int? ScheduleIntervalMinutes,
    DateTime? ScheduledTime
);
