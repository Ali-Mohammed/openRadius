using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Backend.DTOs;
using Backend.Services;

namespace Backend.Controllers.Management;

/// <summary>
/// API controller for viewing and querying the system audit log.
/// All endpoints use UUID-only external identifiers. Internal IDs are never exposed.
/// </summary>
[ApiController]
[Route("api/audit-logs")]
[Authorize]
public class AuditLogController : ControllerBase
{
    private readonly IAuditService _auditService;
    private readonly ILogger<AuditLogController> _logger;

    public AuditLogController(
        IAuditService auditService,
        ILogger<AuditLogController> logger)
    {
        _auditService = auditService;
        _logger = logger;
    }

    /// <summary>
    /// Gets a paginated, filtered, sorted list of audit log entries.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AuditLogPagedResponse>> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] Guid? entityUuid = null,
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        [FromQuery] Guid? performedByUuid = null,
        [FromQuery] Guid? targetUserUuid = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortField = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            var filter = new AuditLogFilterDto
            {
                Search = search,
                Action = action,
                EntityType = entityType,
                EntityUuid = entityUuid,
                Category = category,
                Status = status,
                PerformedByUuid = performedByUuid,
                TargetUserUuid = targetUserUuid,
                StartDate = startDate,
                EndDate = endDate,
                Page = Math.Max(1, page),
                PageSize = Math.Clamp(pageSize, 1, 200),
                SortField = sortField,
                SortDirection = sortDirection,
            };

            var result = await _auditService.GetLogsAsync(filter);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit logs");
            return StatusCode(500, new { error = "An error occurred while retrieving audit logs" });
        }
    }

    /// <summary>
    /// Gets a single audit log entry by UUID.
    /// </summary>
    [HttpGet("{uuid:guid}")]
    public async Task<ActionResult<AuditLogDto>> GetByUuid(Guid uuid)
    {
        try
        {
            var entry = await _auditService.GetByUuidAsync(uuid);
            if (entry == null)
                return NotFound(new { error = "Audit log entry not found" });

            return Ok(entry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit log entry {Uuid}", uuid);
            return StatusCode(500, new { error = "An error occurred while retrieving the audit log entry" });
        }
    }

    /// <summary>
    /// Gets audit log statistics for dashboard display.
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult<AuditLogStatsDto>> GetStats(
        [FromQuery] string? category = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            var filter = new AuditLogFilterDto
            {
                Category = category,
                StartDate = startDate,
                EndDate = endDate,
            };

            var stats = await _auditService.GetStatsAsync(filter);
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit log stats");
            return StatusCode(500, new { error = "An error occurred while retrieving audit log statistics" });
        }
    }

    /// <summary>
    /// Gets all distinct categories for filter dropdowns.
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<List<string>>> GetCategories()
    {
        try
        {
            var categories = await _auditService.GetCategoriesAsync();
            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit log categories");
            return StatusCode(500, new { error = "An error occurred while retrieving categories" });
        }
    }

    /// <summary>
    /// Gets all distinct actions for filter dropdowns.
    /// </summary>
    [HttpGet("actions")]
    public async Task<ActionResult<List<string>>> GetActions()
    {
        try
        {
            var actions = await _auditService.GetActionsAsync();
            return Ok(actions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit log actions");
            return StatusCode(500, new { error = "An error occurred while retrieving actions" });
        }
    }

    /// <summary>
    /// Gets all distinct entity types for filter dropdowns.
    /// </summary>
    [HttpGet("entity-types")]
    public async Task<ActionResult<List<string>>> GetEntityTypes()
    {
        try
        {
            var entityTypes = await _auditService.GetEntityTypesAsync();
            return Ok(entityTypes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit log entity types");
            return StatusCode(500, new { error = "An error occurred while retrieving entity types" });
        }
    }

    /// <summary>
    /// Gets the full activity history for a specific entity (by UUID).
    /// </summary>
    [HttpGet("entity/{entityUuid:guid}")]
    public async Task<ActionResult<AuditLogPagedResponse>> GetByEntity(
        Guid entityUuid,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var filter = new AuditLogFilterDto
            {
                EntityUuid = entityUuid,
                Page = Math.Max(1, page),
                PageSize = Math.Clamp(pageSize, 1, 200),
            };

            var result = await _auditService.GetLogsAsync(filter);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit logs for entity {EntityUuid}", entityUuid);
            return StatusCode(500, new { error = "An error occurred while retrieving entity audit logs" });
        }
    }

    /// <summary>
    /// Gets the full activity history for a specific user (by UUID).
    /// Returns all actions performed by this user.
    /// </summary>
    [HttpGet("user/{userUuid:guid}")]
    public async Task<ActionResult<AuditLogPagedResponse>> GetByUser(
        Guid userUuid,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        try
        {
            var filter = new AuditLogFilterDto
            {
                PerformedByUuid = userUuid,
                Page = Math.Max(1, page),
                PageSize = Math.Clamp(pageSize, 1, 200),
            };

            var result = await _auditService.GetLogsAsync(filter);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving audit logs for user {UserUuid}", userUuid);
            return StatusCode(500, new { error = "An error occurred while retrieving user audit logs" });
        }
    }
}
