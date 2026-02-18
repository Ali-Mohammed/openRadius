using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;

namespace Backend.Controllers;

/// <summary>
/// Enterprise automation execution history API.
/// All endpoints use UUID-only identifiers — internal IDs are never exposed.
/// </summary>
[ApiController]
[Route("api/automation-executions")]
public class AutomationExecutionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AutomationExecutionController> _logger;

    public AutomationExecutionController(
        ApplicationDbContext context,
        ILogger<AutomationExecutionController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ─── List executions (paginated, filterable) ────────────────────────────

    /// <summary>
    /// GET: api/automation-executions
    /// Returns a paginated list of automation executions with filtering and sorting.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetExecutions([FromQuery] AutomationExecutionQueryDto query)
    {
        try
        {
            var q = _context.AutomationExecutionLogs
                .Include(e => e.Automation)
                .AsQueryable();

            // Filter by automation UUID
            if (query.AutomationUuid.HasValue)
            {
                var automation = await _context.Automations
                    .FirstOrDefaultAsync(a => a.Uuid == query.AutomationUuid.Value);
                if (automation == null)
                    return NotFound(new { message = "Automation not found" });
                q = q.Where(e => e.AutomationId == automation.Id);
            }

            // Filter by trigger type
            if (!string.IsNullOrWhiteSpace(query.TriggerType))
                q = q.Where(e => e.TriggerType == query.TriggerType);

            // Filter by status
            if (!string.IsNullOrWhiteSpace(query.Status))
                q = q.Where(e => e.Status == query.Status);

            // Filter by RADIUS user UUID
            if (query.RadiusUserUuid.HasValue)
                q = q.Where(e => e.RadiusUserUuid == query.RadiusUserUuid.Value);

            // Filter by RADIUS username (partial match)
            if (!string.IsNullOrWhiteSpace(query.RadiusUsername))
                q = q.Where(e => e.RadiusUsername != null && e.RadiusUsername.Contains(query.RadiusUsername));

            // Filter by date range
            if (query.DateFrom.HasValue)
                q = q.Where(e => e.CreatedAt >= query.DateFrom.Value);
            if (query.DateTo.HasValue)
                q = q.Where(e => e.CreatedAt <= query.DateTo.Value);

            // Total count before pagination
            var totalCount = await q.CountAsync();

            // Sort
            q = (query.SortBy?.ToLowerInvariant(), query.SortDirection?.ToLowerInvariant()) switch
            {
                ("executiontimems", "asc") => q.OrderBy(e => e.ExecutionTimeMs),
                ("executiontimems", _) => q.OrderByDescending(e => e.ExecutionTimeMs),
                ("status", "asc") => q.OrderBy(e => e.Status),
                ("status", _) => q.OrderByDescending(e => e.Status),
                ("triggertype", "asc") => q.OrderBy(e => e.TriggerType),
                ("triggertype", _) => q.OrderByDescending(e => e.TriggerType),
                ("createdat", "asc") => q.OrderBy(e => e.CreatedAt),
                _ => q.OrderByDescending(e => e.CreatedAt)
            };

            // Paginate
            var page = Math.Max(1, query.Page);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var executions = await q
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Map to summary DTOs
            var items = executions.Select(e => new AutomationExecutionSummaryDto
            {
                Uuid = e.Uuid,
                AutomationUuid = e.Automation?.Uuid ?? Guid.Empty,
                AutomationTitle = e.AutomationTitle,
                TriggerType = e.TriggerType,
                RadiusUserUuid = e.RadiusUserUuid,
                RadiusUsername = e.RadiusUsername,
                Status = e.Status,
                ResultSummary = e.ResultSummary,
                ActionsExecuted = e.ActionsExecuted,
                ActionsSucceeded = e.ActionsSucceeded,
                ActionsFailed = e.ActionsFailed,
                ExecutionTimeMs = e.ExecutionTimeMs,
                TriggeredBy = e.TriggeredBy,
                CorrelationId = e.CorrelationId,
                CreatedAt = e.CreatedAt,
                CompletedAt = e.CompletedAt
            }).ToList();

            return Ok(new
            {
                items,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching automation executions");
            return StatusCode(500, new { message = "Failed to retrieve execution history" });
        }
    }

    // ─── Get single execution with full details ─────────────────────────────

    /// <summary>
    /// GET: api/automation-executions/{uuid}
    /// Returns full execution details including all per-node steps.
    /// </summary>
    [HttpGet("{uuid:guid}")]
    public async Task<ActionResult<AutomationExecutionLogDto>> GetExecution(Guid uuid)
    {
        try
        {
            var execution = await _context.AutomationExecutionLogs
                .Include(e => e.Automation)
                .Include(e => e.Steps.OrderBy(s => s.StepOrder))
                .FirstOrDefaultAsync(e => e.Uuid == uuid);

            if (execution == null)
                return NotFound(new { message = "Execution not found" });

            var dto = MapToDetailDto(execution);

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching execution {Uuid}", uuid);
            return StatusCode(500, new { message = "Failed to retrieve execution details" });
        }
    }

    // ─── Get executions for a specific automation ───────────────────────────

    /// <summary>
    /// GET: api/automation-executions/by-automation/{automationUuid}
    /// Convenience endpoint to get all executions for an automation.
    /// </summary>
    [HttpGet("by-automation/{automationUuid:guid}")]
    public async Task<ActionResult<object>> GetExecutionsByAutomation(
        Guid automationUuid,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = null)
    {
        try
        {
            var automation = await _context.Automations
                .FirstOrDefaultAsync(a => a.Uuid == automationUuid);

            if (automation == null)
                return NotFound(new { message = "Automation not found" });

            var q = _context.AutomationExecutionLogs
                .Where(e => e.AutomationId == automation.Id)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                q = q.Where(e => e.Status == status);

            var totalCount = await q.CountAsync();

            var sanitizedPage = Math.Max(1, page);
            var sanitizedPageSize = Math.Clamp(pageSize, 1, 100);

            var executions = await q
                .OrderByDescending(e => e.CreatedAt)
                .Skip((sanitizedPage - 1) * sanitizedPageSize)
                .Take(sanitizedPageSize)
                .ToListAsync();

            var items = executions.Select(e => new AutomationExecutionSummaryDto
            {
                Uuid = e.Uuid,
                AutomationUuid = automation.Uuid,
                AutomationTitle = e.AutomationTitle,
                TriggerType = e.TriggerType,
                RadiusUserUuid = e.RadiusUserUuid,
                RadiusUsername = e.RadiusUsername,
                Status = e.Status,
                ResultSummary = e.ResultSummary,
                ActionsExecuted = e.ActionsExecuted,
                ActionsSucceeded = e.ActionsSucceeded,
                ActionsFailed = e.ActionsFailed,
                ExecutionTimeMs = e.ExecutionTimeMs,
                TriggeredBy = e.TriggeredBy,
                CorrelationId = e.CorrelationId,
                CreatedAt = e.CreatedAt,
                CompletedAt = e.CompletedAt
            }).ToList();

            // Summary statistics
            var allLogs = await _context.AutomationExecutionLogs
                .Where(e => e.AutomationId == automation.Id)
                .ToListAsync();

            var stats = new
            {
                totalExecutions = allLogs.Count,
                completed = allLogs.Count(e => e.Status == "completed"),
                completedWithErrors = allLogs.Count(e => e.Status == "completed_with_errors"),
                failed = allLogs.Count(e => e.Status == "failed"),
                running = allLogs.Count(e => e.Status == "running"),
                avgExecutionTimeMs = allLogs.Any() ? (long)allLogs.Average(e => e.ExecutionTimeMs) : 0,
                lastExecutedAt = allLogs.Any() ? allLogs.Max(e => e.CreatedAt) : (DateTime?)null
            };

            return Ok(new
            {
                items,
                totalCount,
                page = sanitizedPage,
                pageSize = sanitizedPageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / sanitizedPageSize),
                stats
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching executions for automation {Uuid}", automationUuid);
            return StatusCode(500, new { message = "Failed to retrieve execution history" });
        }
    }

    // ─── Get steps for an execution ─────────────────────────────────────────

    /// <summary>
    /// GET: api/automation-executions/{uuid}/steps
    /// Returns all steps for a specific execution, ordered by step order.
    /// </summary>
    [HttpGet("{uuid:guid}/steps")]
    public async Task<ActionResult<List<AutomationExecutionStepDto>>> GetExecutionSteps(Guid uuid)
    {
        try
        {
            var execution = await _context.AutomationExecutionLogs
                .FirstOrDefaultAsync(e => e.Uuid == uuid);

            if (execution == null)
                return NotFound(new { message = "Execution not found" });

            var steps = await _context.AutomationExecutionSteps
                .Where(s => s.ExecutionLogId == execution.Id)
                .OrderBy(s => s.StepOrder)
                .ToListAsync();

            var dtos = steps.Select(MapStepToDto).ToList();

            return Ok(dtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching steps for execution {Uuid}", uuid);
            return StatusCode(500, new { message = "Failed to retrieve execution steps" });
        }
    }

    // ─── Delete execution log ───────────────────────────────────────────────

    /// <summary>
    /// DELETE: api/automation-executions/{uuid}
    /// Hard delete an execution log and its steps (cascade).
    /// </summary>
    [HttpDelete("{uuid:guid}")]
    public async Task<ActionResult> DeleteExecution(Guid uuid)
    {
        try
        {
            var execution = await _context.AutomationExecutionLogs
                .FirstOrDefaultAsync(e => e.Uuid == uuid);

            if (execution == null)
                return NotFound(new { message = "Execution not found" });

            _context.AutomationExecutionLogs.Remove(execution);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted execution log {Uuid}", uuid);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting execution {Uuid}", uuid);
            return StatusCode(500, new { message = "Failed to delete execution" });
        }
    }

    // ─── Bulk delete old executions ─────────────────────────────────────────

    /// <summary>
    /// DELETE: api/automation-executions/bulk
    /// Delete execution logs older than a specified date or filtered by automation.
    /// </summary>
    [HttpDelete("bulk")]
    public async Task<ActionResult<object>> BulkDeleteExecutions(
        [FromQuery] Guid? automationUuid,
        [FromQuery] DateTime? olderThan,
        [FromQuery] string? status)
    {
        try
        {
            var q = _context.AutomationExecutionLogs.AsQueryable();

            if (automationUuid.HasValue)
            {
                var automation = await _context.Automations
                    .FirstOrDefaultAsync(a => a.Uuid == automationUuid.Value);
                if (automation == null)
                    return NotFound(new { message = "Automation not found" });
                q = q.Where(e => e.AutomationId == automation.Id);
            }

            if (olderThan.HasValue)
                q = q.Where(e => e.CreatedAt < olderThan.Value);

            if (!string.IsNullOrWhiteSpace(status))
                q = q.Where(e => e.Status == status);

            var toDelete = await q.ToListAsync();
            var count = toDelete.Count;

            _context.AutomationExecutionLogs.RemoveRange(toDelete);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Bulk deleted {Count} execution logs", count);
            return Ok(new { deletedCount = count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error bulk deleting executions");
            return StatusCode(500, new { message = "Failed to bulk delete executions" });
        }
    }

    // ─── Mapping helpers ────────────────────────────────────────────────────

    private static AutomationExecutionLogDto MapToDetailDto(AutomationExecutionLog e)
    {
        return new AutomationExecutionLogDto
        {
            Uuid = e.Uuid,
            AutomationUuid = e.Automation?.Uuid ?? Guid.Empty,
            AutomationTitle = e.AutomationTitle,
            TriggerType = e.TriggerType,
            TriggerNodeId = e.TriggerNodeId,
            RadiusUserUuid = e.RadiusUserUuid,
            RadiusUsername = e.RadiusUsername,
            Status = e.Status,
            ResultSummary = e.ResultSummary,
            ErrorMessage = e.ErrorMessage,
            TotalNodes = e.TotalNodes,
            TotalEdges = e.TotalEdges,
            NodesVisited = e.NodesVisited,
            ActionsExecuted = e.ActionsExecuted,
            ActionsSucceeded = e.ActionsSucceeded,
            ActionsFailed = e.ActionsFailed,
            ConditionsEvaluated = e.ConditionsEvaluated,
            ExecutionTimeMs = e.ExecutionTimeMs,
            TriggeredBy = e.TriggeredBy,
            SourceIpAddress = e.SourceIpAddress,
            CorrelationId = e.CorrelationId,
            Environment = e.Environment,
            CreatedAt = e.CreatedAt,
            StartedAt = e.StartedAt,
            CompletedAt = e.CompletedAt,
            Steps = e.Steps?.OrderBy(s => s.StepOrder).Select(MapStepToDto).ToList()
        };
    }

    private static AutomationExecutionStepDto MapStepToDto(AutomationExecutionStep s)
    {
        return new AutomationExecutionStepDto
        {
            Uuid = s.Uuid,
            StepOrder = s.StepOrder,
            NodeId = s.NodeId,
            NodeType = s.NodeType,
            NodeSubType = s.NodeSubType,
            NodeLabel = s.NodeLabel,
            Status = s.Status,
            Result = s.Result,
            ErrorMessage = s.ErrorMessage,
            InputData = s.InputData,
            OutputData = s.OutputData,
            ExecutionTimeMs = s.ExecutionTimeMs,
            HttpMethod = s.HttpMethod,
            HttpUrl = s.HttpUrl,
            HttpRequestHeaders = s.HttpRequestHeaders,
            HttpRequestBody = s.HttpRequestBody,
            HttpResponseStatusCode = s.HttpResponseStatusCode,
            HttpResponseHeaders = s.HttpResponseHeaders,
            HttpResponseBody = s.HttpResponseBody,
            HttpResponseTimeMs = s.HttpResponseTimeMs,
            CreatedAt = s.CreatedAt,
            CompletedAt = s.CompletedAt
        };
    }
}
