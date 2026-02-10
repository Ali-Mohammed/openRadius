using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs;

// ── Response DTO ────────────────────────────────────────────────────────────

/// <summary>
/// Audit log entry returned by the API. Uses UUID-only external identifiers.
/// Internal int IDs are never exposed.
/// </summary>
public class AuditLogDto
{
    public Guid Uuid { get; set; }

    // Action
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityUuid { get; set; }
    public string Category { get; set; } = string.Empty;

    // Snapshots
    public string? PreviousData { get; set; }
    public string? NewData { get; set; }
    public string? Changes { get; set; }

    // Context
    public string? Description { get; set; }
    public string? Reason { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? RequestPath { get; set; }
    public string? CorrelationId { get; set; }
    public string? Metadata { get; set; }

    // Outcome
    public string Status { get; set; } = "Success";
    public string? ErrorMessage { get; set; }

    // Users (resolved names for display)
    public AuditUserDto? PerformedBy { get; set; }
    public AuditUserDto? TargetUser { get; set; }

    // Timestamps
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Lightweight user representation in audit log responses.
/// </summary>
public class AuditUserDto
{
    public Guid Uuid { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
}

// ── Paginated Response ──────────────────────────────────────────────────────

public class AuditLogPagedResponse
{
    public List<AuditLogDto> Data { get; set; } = new();
    public int CurrentPage { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages { get; set; }
}

// ── Stats Response ──────────────────────────────────────────────────────────

public class AuditLogStatsDto
{
    public int TotalEntries { get; set; }
    public int TodayEntries { get; set; }
    public int FailedEntries { get; set; }
    public List<AuditCategoryCountDto> ByCategory { get; set; } = new();
    public List<AuditActionCountDto> ByAction { get; set; } = new();
}

public class AuditCategoryCountDto
{
    public string Category { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class AuditActionCountDto
{
    public string Action { get; set; } = string.Empty;
    public int Count { get; set; }
}

// ── Filter/Query DTO ────────────────────────────────────────────────────────

public class AuditLogFilterDto
{
    public string? Search { get; set; }
    public string? Action { get; set; }
    public string? EntityType { get; set; }
    public Guid? EntityUuid { get; set; }
    public string? Category { get; set; }
    public string? Status { get; set; }
    public Guid? PerformedByUuid { get; set; }
    public Guid? TargetUserUuid { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
    public string? SortField { get; set; }
    public string? SortDirection { get; set; }
}

// ── Create Audit Log Request (Internal use / API) ───────────────────────────

/// <summary>
/// DTO for programmatically recording an audit entry.
/// </summary>
public class CreateAuditLogDto
{
    [Required]
    [MaxLength(50)]
    public string Action { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string EntityType { get; set; } = string.Empty;

    public Guid? EntityUuid { get; set; }

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = string.Empty;

    public string? PreviousData { get; set; }
    public string? NewData { get; set; }
    public string? Changes { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(2000)]
    public string? Reason { get; set; }

    public string? Metadata { get; set; }

    public string? Status { get; set; } = "Success";
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// UUID of the target user (the user whose resource was affected)
    /// </summary>
    public Guid? TargetUserUuid { get; set; }
}
