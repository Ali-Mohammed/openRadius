using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;
using Backend.Services;
using Finbuckle.MultiTenant;
using Finbuckle.MultiTenant.Abstractions;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AutomationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AutomationController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IAutomationSchedulerService _schedulerService;
    private readonly IMultiTenantContextAccessor<WorkspaceTenantInfo> _tenantAccessor;

    public AutomationController(
        ApplicationDbContext context,
        ILogger<AutomationController> logger,
        IHttpContextAccessor httpContextAccessor,
        IAutomationSchedulerService schedulerService,
        IMultiTenantContextAccessor<WorkspaceTenantInfo> tenantAccessor)
    {
        _context = context;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
        _schedulerService = schedulerService;
        _tenantAccessor = tenantAccessor;
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

            // Register Hangfire job if this is a scheduled automation
            SyncAutomationHangfireJob(automation);

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

            // Update Hangfire job (register/update/remove based on trigger type & status)
            SyncAutomationHangfireJob(automation);

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

            // Remove Hangfire job for deleted automation
            RemoveAutomationHangfireJob(automation.Id);

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
    /// <summary>
    /// Syncs the Hangfire job for a scheduled automation using current tenant context.
    /// </summary>
    private void SyncAutomationHangfireJob(Automation automation)
    {
        try
        {
            var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
            if (tenantInfo?.ConnectionString == null)
            {
                _logger.LogWarning("No tenant context available for Hangfire job sync");
                return;
            }

            ((AutomationSchedulerService)_schedulerService)
                .SyncAutomationJob(automation, tenantInfo.WorkspaceId, tenantInfo.ConnectionString);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to sync Hangfire job for automation {AutomationId}", automation.Id);
        }
    }

    /// <summary>
    /// Removes the Hangfire job for an automation using current tenant context.
    /// </summary>
    private void RemoveAutomationHangfireJob(int automationId)
    {
        try
        {
            var tenantInfo = _tenantAccessor.MultiTenantContext?.TenantInfo;
            if (tenantInfo?.ConnectionString == null)
            {
                _logger.LogWarning("No tenant context available for Hangfire job removal");
                return;
            }

            ((AutomationSchedulerService)_schedulerService)
                .RemoveAutomationJob(automationId, tenantInfo.WorkspaceId, tenantInfo.ConnectionString);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove Hangfire job for automation {AutomationId}", automationId);
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
