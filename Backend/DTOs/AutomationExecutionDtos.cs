namespace Backend.DTOs;

// ── Response DTOs ───────────────────────────────────────────────────────────

/// <summary>
/// Automation execution log returned by the API. Uses UUID-only external identifiers.
/// Internal int IDs are never exposed.
/// </summary>
public class AutomationExecutionLogDto
{
    public Guid Uuid { get; set; }
    
    // Automation reference
    public Guid AutomationUuid { get; set; }
    public string? AutomationTitle { get; set; }
    
    // Trigger
    public string TriggerType { get; set; } = null!;
    public string? TriggerNodeId { get; set; }
    
    // RADIUS user
    public Guid? RadiusUserUuid { get; set; }
    public string? RadiusUsername { get; set; }
    
    // Status & results
    public string Status { get; set; } = null!;
    public string? ResultSummary { get; set; }
    public string? ErrorMessage { get; set; }
    
    // Metrics
    public int TotalNodes { get; set; }
    public int TotalEdges { get; set; }
    public int NodesVisited { get; set; }
    public int ActionsExecuted { get; set; }
    public int ActionsSucceeded { get; set; }
    public int ActionsFailed { get; set; }
    public int ConditionsEvaluated { get; set; }
    public long ExecutionTimeMs { get; set; }
    
    // Audit
    public string? TriggeredBy { get; set; }
    public string? SourceIpAddress { get; set; }
    public Guid CorrelationId { get; set; }
    public string? Environment { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    
    // Steps (only included in detail view)
    public List<AutomationExecutionStepDto>? Steps { get; set; }
}

/// <summary>
/// Per-node execution step within an automation run.
/// Contains full request/response details for HTTP actions.
/// </summary>
public class AutomationExecutionStepDto
{
    public Guid Uuid { get; set; }
    
    public int StepOrder { get; set; }
    public string NodeId { get; set; } = null!;
    public string NodeType { get; set; } = null!;
    public string? NodeSubType { get; set; }
    public string? NodeLabel { get; set; }
    
    // Result
    public string Status { get; set; } = null!;
    public string? Result { get; set; }
    public string? ErrorMessage { get; set; }
    
    // Data
    public string? InputData { get; set; }
    public string? OutputData { get; set; }
    public long ExecutionTimeMs { get; set; }
    
    // HTTP details (populated for http-request action steps)
    public string? HttpMethod { get; set; }
    public string? HttpUrl { get; set; }
    public string? HttpRequestHeaders { get; set; }
    public string? HttpRequestBody { get; set; }
    public int? HttpResponseStatusCode { get; set; }
    public string? HttpResponseHeaders { get; set; }
    public string? HttpResponseBody { get; set; }
    public long? HttpResponseTimeMs { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

// ── Summary DTO (for list views) ────────────────────────────────────────────

/// <summary>
/// Lightweight execution summary for list views (without steps).
/// </summary>
public class AutomationExecutionSummaryDto
{
    public Guid Uuid { get; set; }
    public Guid AutomationUuid { get; set; }
    public string? AutomationTitle { get; set; }
    public string TriggerType { get; set; } = null!;
    public Guid? RadiusUserUuid { get; set; }
    public string? RadiusUsername { get; set; }
    public string Status { get; set; } = null!;
    public string? ResultSummary { get; set; }
    public int ActionsExecuted { get; set; }
    public int ActionsSucceeded { get; set; }
    public int ActionsFailed { get; set; }
    public long ExecutionTimeMs { get; set; }
    public string? TriggeredBy { get; set; }
    public Guid CorrelationId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

// ── Filter / Query DTO ──────────────────────────────────────────────────────

/// <summary>
/// Query parameters for filtering execution history.
/// </summary>
public class AutomationExecutionQueryDto
{
    public Guid? AutomationUuid { get; set; }
    public string? TriggerType { get; set; }
    public string? Status { get; set; }
    public Guid? RadiusUserUuid { get; set; }
    public string? RadiusUsername { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
    public string SortBy { get; set; } = "createdAt";
    public string SortDirection { get; set; } = "desc";
}
