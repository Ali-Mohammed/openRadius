using Backend.DTOs;
using Backend.Models.Management;
using System.Security.Claims;

namespace Backend.Services;

/// <summary>
/// Service for recording and querying audit log entries.
/// Provides a centralized, reusable audit trail for all system activities.
/// </summary>
public interface IAuditService
{
    /// <summary>
    /// Records a new audit log entry.
    /// </summary>
    Task<AuditLog> LogAsync(CreateAuditLogDto dto, ClaimsPrincipal? user = null, HttpContext? httpContext = null);

    /// <summary>
    /// Records a new audit log entry with explicit user ID (for background jobs).
    /// </summary>
    Task<AuditLog> LogAsync(CreateAuditLogDto dto, int performedByUserId, string? ipAddress = null, string? userAgent = null, string? requestPath = null);

    /// <summary>
    /// Gets a paginated, filtered, sorted list of audit log entries.
    /// </summary>
    Task<AuditLogPagedResponse> GetLogsAsync(AuditLogFilterDto filter);

    /// <summary>
    /// Gets a single audit log entry by UUID.
    /// </summary>
    Task<AuditLogDto?> GetByUuidAsync(Guid uuid);

    /// <summary>
    /// Gets audit log statistics for dashboard widgets.
    /// </summary>
    Task<AuditLogStatsDto> GetStatsAsync(AuditLogFilterDto? filter = null);

    /// <summary>
    /// Gets all distinct categories currently in the audit log.
    /// </summary>
    Task<List<string>> GetCategoriesAsync();

    /// <summary>
    /// Gets all distinct actions currently in the audit log.
    /// </summary>
    Task<List<string>> GetActionsAsync();

    /// <summary>
    /// Gets all distinct entity types currently in the audit log.
    /// </summary>
    Task<List<string>> GetEntityTypesAsync();
}
