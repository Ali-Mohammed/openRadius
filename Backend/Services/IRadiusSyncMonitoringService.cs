namespace Backend.Services;

/// <summary>
/// Enterprise service for monitoring Debezium JDBC Sink connector health,
/// sync status, and managing connector configuration for edge runtime instances.
/// Communicates with the Kafka Connect REST API.
/// </summary>
public interface IRadiusSyncMonitoringService
{
    // ── Connector Discovery ──────────────────────────────────────────────

    /// <summary>
    /// Lists all registered connectors on the Connect cluster.
    /// </summary>
    Task<List<ConnectorSummaryDto>> ListConnectorsAsync(string connectUrl);

    /// <summary>
    /// Gets detailed status for a specific connector (state, worker, tasks).
    /// </summary>
    Task<ConnectorDetailDto?> GetConnectorStatusAsync(string connectUrl, string connectorName);

    // ── Connector Configuration ──────────────────────────────────────────

    /// <summary>
    /// Gets the current configuration for a connector.
    /// </summary>
    Task<Dictionary<string, string>?> GetConnectorConfigAsync(string connectUrl, string connectorName);

    /// <summary>
    /// Updates a connector's configuration (PUT semantics — full replace).
    /// </summary>
    Task<ConnectorOperationResult> UpdateConnectorConfigAsync(string connectUrl, string connectorName, Dictionary<string, string> config);

    /// <summary>
    /// Creates a new connector with the given configuration.
    /// </summary>
    Task<ConnectorOperationResult> CreateConnectorAsync(string connectUrl, string connectorName, Dictionary<string, string> config);

    /// <summary>
    /// Deletes a connector.
    /// </summary>
    Task<ConnectorOperationResult> DeleteConnectorAsync(string connectUrl, string connectorName);

    // ── Connector Lifecycle ──────────────────────────────────────────────

    /// <summary>
    /// Restarts a connector (all tasks).
    /// </summary>
    Task<ConnectorOperationResult> RestartConnectorAsync(string connectUrl, string connectorName);

    /// <summary>
    /// Restarts a specific task of a connector.
    /// </summary>
    Task<ConnectorOperationResult> RestartTaskAsync(string connectUrl, string connectorName, int taskId);

    /// <summary>
    /// Pauses a running connector.
    /// </summary>
    Task<ConnectorOperationResult> PauseConnectorAsync(string connectUrl, string connectorName);

    /// <summary>
    /// Resumes a paused connector.
    /// </summary>
    Task<ConnectorOperationResult> ResumeConnectorAsync(string connectUrl, string connectorName);

    // ── Cluster Health ───────────────────────────────────────────────────

    /// <summary>
    /// Gets Kafka Connect cluster information (version, commit, plugins).
    /// </summary>
    Task<ConnectClusterInfoDto?> GetClusterInfoAsync(string connectUrl);

    /// <summary>
    /// Gets a list of available connector plugins on the cluster.
    /// </summary>
    Task<List<ConnectorPluginDto>> GetPluginsAsync(string connectUrl);

    /// <summary>
    /// Performs a comprehensive health check across all connectors and returns
    /// an aggregated status report for the edge-admin dashboard.
    /// </summary>
    Task<SyncHealthReportDto> GetHealthReportAsync(string connectUrl);

    // ── Topic Inspection ─────────────────────────────────────────────────

    /// <summary>
    /// Gets topic names from the connector configuration for display purposes.
    /// </summary>
    Task<List<string>> GetConnectorTopicsAsync(string connectUrl, string connectorName);
}
