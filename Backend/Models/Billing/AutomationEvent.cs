namespace Backend.Models;

/// <summary>
/// Defines the types of events that can trigger automation workflows.
/// These map to trigger node types in the workflow designer (e.g., 'user-created', 'user-updated').
/// </summary>
public enum AutomationEventType
{
    UserCreated,
    UserUpdated,
    UserActivated,
    UserExpired,
    UserChurned,
    PaymentReceived,
    UserDeleted,
    Scheduled,
    ManualRequest
}

/// <summary>
/// Represents a domain event that can trigger automation workflows.
/// Carries contextual data about the event for use in workflow conditions and actions.
/// </summary>
public class AutomationEvent
{
    public AutomationEventType EventType { get; set; }
    
    /// <summary>
    /// The trigger type string matching the frontend workflow designer node types.
    /// E.g., "user-created", "user-updated", "user-activated"
    /// </summary>
    public string TriggerType { get; set; } = null!;
    
    /// <summary>
    /// The RADIUS user ID that triggered the event (internal ID for DB operations).
    /// </summary>
    public int RadiusUserId { get; set; }
    
    /// <summary>
    /// The RADIUS user UUID for external reference.
    /// </summary>
    public Guid RadiusUserUuid { get; set; }
    
    /// <summary>
    /// The RADIUS username.
    /// </summary>
    public string? RadiusUsername { get; set; }
    
    /// <summary>
    /// Who performed the action (email or username of the operator).
    /// </summary>
    public string? PerformedBy { get; set; }
    
    /// <summary>
    /// IP address of the request that triggered the event.
    /// </summary>
    public string? IpAddress { get; set; }
    
    /// <summary>
    /// When the event occurred.
    /// </summary>
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Additional context data about the event (changes, amounts, etc.)
    /// Serialized as JSON for flexibility.
    /// </summary>
    public Dictionary<string, object?> Context { get; set; } = new();

    /// <summary>
    /// Helper to map enum to trigger type string used in workflow designer nodes.
    /// </summary>
    public static string GetTriggerTypeString(AutomationEventType eventType) => eventType switch
    {
        AutomationEventType.UserCreated => "user-created",
        AutomationEventType.UserUpdated => "user-updated",
        AutomationEventType.UserActivated => "user-activated",
        AutomationEventType.UserExpired => "user-expired",
        AutomationEventType.UserChurned => "user-churned",
        AutomationEventType.PaymentReceived => "payment-received",
        AutomationEventType.UserDeleted => "user-deleted",
        AutomationEventType.Scheduled => "scheduled",
        AutomationEventType.ManualRequest => "manual-request",
        _ => throw new ArgumentOutOfRangeException(nameof(eventType))
    };
}

/// <summary>
/// Enterprise execution log for a single automation run.
/// Tracks the complete lifecycle from trigger to completion with full audit trail.
/// Each node traversed creates an AutomationExecutionStep child record.
/// </summary>
public class AutomationExecutionLog
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    
    /// <summary>FK to the Automation that was executed.</summary>
    public int AutomationId { get; set; }
    public Automation? Automation { get; set; }
    
    /// <summary>Automation title snapshot (in case it's renamed later).</summary>
    public string? AutomationTitle { get; set; }
    
    /// <summary>The trigger type that started the execution (e.g., "user-created").</summary>
    public string TriggerType { get; set; } = null!;
    
    /// <summary>The trigger node ID from the workflow.</summary>
    public string? TriggerNodeId { get; set; }
    
    /// <summary>The RADIUS user ID that triggered the event.</summary>
    public int? RadiusUserId { get; set; }
    
    /// <summary>The RADIUS user UUID for external display.</summary>
    public Guid? RadiusUserUuid { get; set; }
    
    /// <summary>The RADIUS username for easy lookup.</summary>
    public string? RadiusUsername { get; set; }
    
    /// <summary>
    /// Execution status: "running", "completed", "completed_with_errors", "failed", "skipped".
    /// </summary>
    public string Status { get; set; } = "running";
    
    /// <summary>Human-readable summary of what happened.</summary>
    public string? ResultSummary { get; set; }
    
    /// <summary>Error message if execution failed at the top level.</summary>
    public string? ErrorMessage { get; set; }
    
    /// <summary>Full stack trace for failed executions (enterprise debugging).</summary>
    public string? ErrorStackTrace { get; set; }
    
    /// <summary>Serialized event context data (the full event payload).</summary>
    public string? EventData { get; set; }
    
    /// <summary>Snapshot of the workflow JSON at time of execution (for replay/audit).</summary>
    public string? WorkflowSnapshot { get; set; }
    
    /// <summary>Total nodes in workflow at time of execution.</summary>
    public int TotalNodes { get; set; }
    
    /// <summary>Total edges in workflow at time of execution.</summary>
    public int TotalEdges { get; set; }
    
    /// <summary>Number of nodes visited during traversal.</summary>
    public int NodesVisited { get; set; }
    
    /// <summary>Number of action nodes executed.</summary>
    public int ActionsExecuted { get; set; }
    
    /// <summary>Number of actions that succeeded.</summary>
    public int ActionsSucceeded { get; set; }
    
    /// <summary>Number of actions that failed.</summary>
    public int ActionsFailed { get; set; }
    
    /// <summary>Number of condition nodes evaluated.</summary>
    public int ConditionsEvaluated { get; set; }
    
    /// <summary>Total execution time in milliseconds.</summary>
    public long ExecutionTimeMs { get; set; }
    
    /// <summary>Who triggered the event (operator email/username).</summary>
    public string? TriggeredBy { get; set; }
    
    /// <summary>IP address of the originating request.</summary>
    public string? SourceIpAddress { get; set; }
    
    /// <summary>Correlation ID for tracing across services.</summary>
    public Guid CorrelationId { get; set; } = Guid.NewGuid();
    
    /// <summary>Environment identifier (production, staging, etc.).</summary>
    public string? Environment { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    
    /// <summary>Per-node execution steps (children). Each node visited gets a step record.</summary>
    public ICollection<AutomationExecutionStep> Steps { get; set; } = new List<AutomationExecutionStep>();
}

/// <summary>
/// Per-node execution step within an automation execution run.
/// Records what happened at each node during workflow traversal.
/// Enterprise-grade: contains input/output data, timing, errors, and HTTP details.
/// </summary>
public class AutomationExecutionStep
{
    public int Id { get; set; }
    public Guid Uuid { get; set; } = Guid.NewGuid();
    
    /// <summary>FK to parent execution log.</summary>
    public int ExecutionLogId { get; set; }
    public AutomationExecutionLog? ExecutionLog { get; set; }
    
    /// <summary>Execution order (1, 2, 3...).</summary>
    public int StepOrder { get; set; }
    
    /// <summary>The workflow node ID from ReactFlow.</summary>
    public string NodeId { get; set; } = null!;
    
    /// <summary>Node type: "trigger", "action", "condition", "comment".</summary>
    public string NodeType { get; set; } = null!;
    
    /// <summary>The specific sub-type (e.g., "user-created", "send-email", "http-request", "balance-check").</summary>
    public string? NodeSubType { get; set; }
    
    /// <summary>Node label from the designer.</summary>
    public string? NodeLabel { get; set; }
    
    /// <summary>Step status: "completed", "failed", "skipped", "condition_true", "condition_false".</summary>
    public string Status { get; set; } = "completed";
    
    /// <summary>Human-readable result of this step.</summary>
    public string? Result { get; set; }
    
    /// <summary>Error message if step failed.</summary>
    public string? ErrorMessage { get; set; }
    
    /// <summary>Input data serialized as JSON (what was fed into this node).</summary>
    public string? InputData { get; set; }
    
    /// <summary>Output data serialized as JSON (what this node produced).</summary>
    public string? OutputData { get; set; }
    
    /// <summary>Execution time for this specific step in milliseconds.</summary>
    public long ExecutionTimeMs { get; set; }
    
    // === HTTP Request specific fields ===
    
    /// <summary>HTTP method (GET, POST, PUT, DELETE, PATCH).</summary>
    public string? HttpMethod { get; set; }
    
    /// <summary>HTTP request URL.</summary>
    public string? HttpUrl { get; set; }
    
    /// <summary>HTTP request headers (JSON).</summary>
    public string? HttpRequestHeaders { get; set; }
    
    /// <summary>HTTP request body (JSON/text).</summary>
    public string? HttpRequestBody { get; set; }
    
    /// <summary>HTTP response status code.</summary>
    public int? HttpResponseStatusCode { get; set; }
    
    /// <summary>HTTP response headers (JSON).</summary>
    public string? HttpResponseHeaders { get; set; }
    
    /// <summary>HTTP response body (truncated if too large, max 64KB).</summary>
    public string? HttpResponseBody { get; set; }
    
    /// <summary>HTTP response time in milliseconds.</summary>
    public long? HttpResponseTimeMs { get; set; }
    
    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
