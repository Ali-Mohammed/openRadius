namespace Backend.Services;

// =============================================================================
// DTOs for Sync Monitoring — used by IRadiusSyncMonitoringService & Blazor pages
// =============================================================================

/// <summary>
/// Summary of a single connector (list view).
/// </summary>
public class ConnectorSummaryDto
{
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty; // RUNNING, PAUSED, UNASSIGNED, FAILED
    public string Type { get; set; } = string.Empty;   // sink, source
    public string WorkerId { get; set; } = string.Empty;
    public int TaskCount { get; set; }
    public int RunningTasks { get; set; }
    public int FailedTasks { get; set; }
    public string ConnectorClass { get; set; } = string.Empty;
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Detailed connector info including tasks and trace.
/// </summary>
public class ConnectorDetailDto
{
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string WorkerId { get; set; } = string.Empty;
    public string? Trace { get; set; }
    public List<ConnectorTaskDto> Tasks { get; set; } = new();
    public Dictionary<string, string> Config { get; set; } = new();
    public List<string> Topics { get; set; } = new();
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Represents a single task within a connector.
/// </summary>
public class ConnectorTaskDto
{
    public int Id { get; set; }
    public string State { get; set; } = string.Empty; // RUNNING, FAILED, PAUSED, UNASSIGNED
    public string WorkerId { get; set; } = string.Empty;
    public string? Trace { get; set; }
}

/// <summary>
/// Kafka Connect cluster metadata.
/// </summary>
public class ConnectClusterInfoDto
{
    public string Version { get; set; } = string.Empty;
    public string Commit { get; set; } = string.Empty;
    public string KafkaClusterId { get; set; } = string.Empty;
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// A connector plugin available on the cluster.
/// </summary>
public class ConnectorPluginDto
{
    public string Class { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? Version { get; set; }
}

/// <summary>
/// Result of a connector management operation (create, update, delete, restart, etc.).
/// </summary>
public class ConnectorOperationResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorDetail { get; set; }
    public int StatusCode { get; set; }
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Aggregated health report for the sync-admin dashboard.
/// </summary>
public class SyncHealthReportDto
{
    public string OverallStatus { get; set; } = "UNKNOWN"; // HEALTHY, DEGRADED, CRITICAL, UNKNOWN
    public ConnectClusterInfoDto? Cluster { get; set; }
    public int TotalConnectors { get; set; }
    public int RunningConnectors { get; set; }
    public int FailedConnectors { get; set; }
    public int PausedConnectors { get; set; }
    public int TotalTasks { get; set; }
    public int RunningTasks { get; set; }
    public int FailedTasks { get; set; }
    public List<ConnectorSummaryDto> Connectors { get; set; } = new();
    public List<SyncHealthIssueDto> Issues { get; set; } = new();
    public DateTime CollectedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Individual issue detected during health check.
/// </summary>
public class SyncHealthIssueDto
{
    public string Severity { get; set; } = "INFO"; // INFO, WARNING, ERROR, CRITICAL
    public string Connector { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Trace { get; set; }
}
