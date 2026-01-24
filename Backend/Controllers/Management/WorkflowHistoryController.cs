using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Helpers;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowHistoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WorkflowHistoryController> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public WorkflowHistoryController(
        ApplicationDbContext context,
        ILogger<WorkflowHistoryController> logger,
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

    // GET: api/workflowhistory/automation/{automationId}
    [HttpGet("automation/{automationId}")]
    public async Task<ActionResult<IEnumerable<WorkflowHistory>>> GetHistoryByAutomation(
        int automationId,
        [FromQuery] int limit = 50)
    {
        try
        {
            var history = await _context.WorkflowHistories
                .Where(h => h.AutomationId == automationId)
                .OrderByDescending(h => h.CreatedAt)
                .Take(limit)
                .ToListAsync();

            return Ok(history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workflow history for automation {AutomationId}", automationId);
            return StatusCode(500, new { message = "An error occurred while retrieving workflow history" });
        }
    }

    // POST: api/workflowhistory
    [HttpPost]
    public async Task<ActionResult<WorkflowHistory>> CreateHistory(CreateWorkflowHistoryRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();

            // Verify automation exists
            var automation = await _context.Automations.FindAsync(request.AutomationId);
            if (automation == null)
            {
                return NotFound(new { message = "Automation not found" });
            }

            var history = new WorkflowHistory
            {
                AutomationId = request.AutomationId,
                WorkflowJson = request.WorkflowJson,
                NodeCount = request.NodeCount,
                EdgeCount = request.EdgeCount,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = User.GetSystemUserId()
            };

            _context.WorkflowHistories.Add(history);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created workflow history {HistoryId} for automation {AutomationId}",
                history.Id, request.AutomationId);

            return CreatedAtAction(nameof(GetHistoryByAutomation), 
                new { automationId = history.AutomationId }, history);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating workflow history");
            return StatusCode(500, new { message = "An error occurred while creating workflow history" });
        }
    }

    // DELETE: api/workflowhistory/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteHistory(int id)
    {
        try
        {
            var history = await _context.WorkflowHistories.FindAsync(id);
            if (history == null)
            {
                return NotFound(new { message = "Workflow history not found" });
            }

            _context.WorkflowHistories.Remove(history);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted workflow history {HistoryId}", id);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting workflow history {HistoryId}", id);
            return StatusCode(500, new { message = "An error occurred while deleting workflow history" });
        }
    }

    // DELETE: api/workflowhistory/automation/{automationId}/cleanup
    [HttpDelete("automation/{automationId}/cleanup")]
    public async Task<IActionResult> CleanupOldHistory(int automationId, [FromQuery] int keepLast = 50)
    {
        try
        {
            var historyToDelete = await _context.WorkflowHistories
                .Where(h => h.AutomationId == automationId)
                .OrderByDescending(h => h.CreatedAt)
                .Skip(keepLast)
                .ToListAsync();

            if (historyToDelete.Any())
            {
                _context.WorkflowHistories.RemoveRange(historyToDelete);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Cleaned up {Count} old workflow history entries for automation {AutomationId}", 
                    historyToDelete.Count, automationId);
            }

            return Ok(new { deleted = historyToDelete.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up workflow history for automation {AutomationId}", automationId);
            return StatusCode(500, new { message = "An error occurred while cleaning up workflow history" });
        }
    }
}

public record CreateWorkflowHistoryRequest(
    int AutomationId,
    string WorkflowJson,
    int NodeCount,
    int EdgeCount
);
