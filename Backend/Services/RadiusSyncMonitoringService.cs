using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Services;

/// <summary>
/// Enterprise implementation of IRadiusSyncMonitoringService.
/// Communicates with Kafka Connect REST API to monitor and manage
/// Debezium JDBC Sink connectors for edge runtime synchronization.
/// </summary>
public class RadiusSyncMonitoringService : IRadiusSyncMonitoringService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<RadiusSyncMonitoringService> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RadiusSyncMonitoringService(
        IHttpClientFactory httpClientFactory,
        ILogger<RadiusSyncMonitoringService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    // =========================================================================
    // Connector Discovery
    // =========================================================================

    public async Task<List<ConnectorSummaryDto>> ListConnectorsAsync(string connectUrl)
    {
        var result = new List<ConnectorSummaryDto>();
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{connectUrl.TrimEnd('/')}/connectors?expand=status&expand=info");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to list connectors from {Url}: {StatusCode}", connectUrl, response.StatusCode);
                return result;
            }

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var connectorName = prop.Name;
                var summary = new ConnectorSummaryDto { Name = connectorName, CollectedAt = DateTime.UtcNow };

                if (prop.Value.TryGetProperty("status", out var statusEl))
                {
                    if (statusEl.TryGetProperty("connector", out var connEl))
                    {
                        summary.State = connEl.GetProperty("state").GetString() ?? "UNKNOWN";
                        summary.WorkerId = connEl.TryGetProperty("worker_id", out var wid) ? wid.GetString() ?? "" : "";
                    }
                    if (statusEl.TryGetProperty("type", out var typeEl))
                        summary.Type = typeEl.GetString() ?? "";
                    if (statusEl.TryGetProperty("tasks", out var tasksEl))
                    {
                        summary.TaskCount = tasksEl.GetArrayLength();
                        foreach (var task in tasksEl.EnumerateArray())
                        {
                            var tState = task.GetProperty("state").GetString() ?? "";
                            if (tState == "RUNNING") summary.RunningTasks++;
                            else if (tState == "FAILED") summary.FailedTasks++;
                        }
                    }
                }

                if (prop.Value.TryGetProperty("info", out var infoEl) &&
                    infoEl.TryGetProperty("config", out var cfgEl) &&
                    cfgEl.TryGetProperty("connector.class", out var clsEl))
                {
                    summary.ConnectorClass = clsEl.GetString() ?? "";
                }

                result.Add(summary);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing connectors from {Url}", connectUrl);
        }
        return result;
    }

    public async Task<ConnectorDetailDto?> GetConnectorStatusAsync(string connectUrl, string connectorName)
    {
        try
        {
            var client = CreateClient();
            var statusResponse = await client.GetAsync($"{connectUrl.TrimEnd('/')}/connectors/{connectorName}/status");
            if (!statusResponse.IsSuccessStatusCode) return null;

            var statusJson = await statusResponse.Content.ReadAsStringAsync();
            using var statusDoc = JsonDocument.Parse(statusJson);

            var detail = new ConnectorDetailDto
            {
                Name = connectorName,
                CollectedAt = DateTime.UtcNow
            };

            var root = statusDoc.RootElement;

            if (root.TryGetProperty("connector", out var connEl))
            {
                detail.State = connEl.GetProperty("state").GetString() ?? "UNKNOWN";
                detail.WorkerId = connEl.TryGetProperty("worker_id", out var wid) ? wid.GetString() ?? "" : "";
                detail.Trace = connEl.TryGetProperty("trace", out var tr) ? tr.GetString() : null;
            }

            if (root.TryGetProperty("type", out var typeEl))
                detail.Type = typeEl.GetString() ?? "";

            if (root.TryGetProperty("tasks", out var tasksEl))
            {
                foreach (var task in tasksEl.EnumerateArray())
                {
                    detail.Tasks.Add(new ConnectorTaskDto
                    {
                        Id = task.GetProperty("id").GetInt32(),
                        State = task.GetProperty("state").GetString() ?? "UNKNOWN",
                        WorkerId = task.TryGetProperty("worker_id", out var twid) ? twid.GetString() ?? "" : "",
                        Trace = task.TryGetProperty("trace", out var ttr) ? ttr.GetString() : null
                    });
                }
            }

            // Fetch config separately
            var config = await GetConnectorConfigAsync(connectUrl, connectorName);
            if (config != null)
            {
                detail.Config = config;
                if (config.TryGetValue("topics", out var topics))
                    detail.Topics = topics.Split(',').Select(t => t.Trim()).ToList();
            }

            return detail;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting connector status for {Connector} from {Url}", connectorName, connectUrl);
            return null;
        }
    }

    // =========================================================================
    // Connector Configuration
    // =========================================================================

    public async Task<Dictionary<string, string>?> GetConnectorConfigAsync(string connectUrl, string connectorName)
    {
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{connectUrl.TrimEnd('/')}/connectors/{connectorName}/config");
            if (!response.IsSuccessStatusCode) return null;

            return await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting config for {Connector}", connectorName);
            return null;
        }
    }

    public async Task<ConnectorOperationResult> UpdateConnectorConfigAsync(
        string connectUrl, string connectorName, Dictionary<string, string> config)
    {
        try
        {
            var client = CreateClient();
            var response = await client.PutAsJsonAsync(
                $"{connectUrl.TrimEnd('/')}/connectors/{connectorName}/config", config, JsonOpts);

            var body = await response.Content.ReadAsStringAsync();
            return new ConnectorOperationResult
            {
                Success = response.IsSuccessStatusCode,
                StatusCode = (int)response.StatusCode,
                Message = response.IsSuccessStatusCode
                    ? $"Connector '{connectorName}' configuration updated."
                    : $"Failed to update connector '{connectorName}'.",
                ErrorDetail = response.IsSuccessStatusCode ? null : body,
                PerformedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating config for {Connector}", connectorName);
            return new ConnectorOperationResult
            {
                Success = false,
                Message = $"Exception updating connector: {ex.Message}",
                ErrorDetail = ex.ToString()
            };
        }
    }

    public async Task<ConnectorOperationResult> CreateConnectorAsync(
        string connectUrl, string connectorName, Dictionary<string, string> config)
    {
        try
        {
            var client = CreateClient();
            var payload = new { name = connectorName, config };
            var response = await client.PostAsJsonAsync(
                $"{connectUrl.TrimEnd('/')}/connectors", payload, JsonOpts);

            var body = await response.Content.ReadAsStringAsync();
            return new ConnectorOperationResult
            {
                Success = response.IsSuccessStatusCode,
                StatusCode = (int)response.StatusCode,
                Message = response.IsSuccessStatusCode
                    ? $"Connector '{connectorName}' created successfully."
                    : $"Failed to create connector '{connectorName}'.",
                ErrorDetail = response.IsSuccessStatusCode ? null : body,
                PerformedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating connector {Connector}", connectorName);
            return new ConnectorOperationResult
            {
                Success = false,
                Message = $"Exception creating connector: {ex.Message}",
                ErrorDetail = ex.ToString()
            };
        }
    }

    public async Task<ConnectorOperationResult> DeleteConnectorAsync(string connectUrl, string connectorName)
    {
        try
        {
            var client = CreateClient();
            var response = await client.DeleteAsync($"{connectUrl.TrimEnd('/')}/connectors/{connectorName}");

            return new ConnectorOperationResult
            {
                Success = response.IsSuccessStatusCode,
                StatusCode = (int)response.StatusCode,
                Message = response.IsSuccessStatusCode
                    ? $"Connector '{connectorName}' deleted."
                    : $"Failed to delete connector '{connectorName}'.",
                PerformedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting connector {Connector}", connectorName);
            return new ConnectorOperationResult
            {
                Success = false,
                Message = $"Exception deleting connector: {ex.Message}",
                ErrorDetail = ex.ToString()
            };
        }
    }

    // =========================================================================
    // Connector Lifecycle
    // =========================================================================

    public async Task<ConnectorOperationResult> RestartConnectorAsync(string connectUrl, string connectorName)
    {
        return await PostLifecycleAction(connectUrl, $"/connectors/{connectorName}/restart?includeTasks=true&onlyFailed=false", connectorName, "restart");
    }

    public async Task<ConnectorOperationResult> RestartTaskAsync(string connectUrl, string connectorName, int taskId)
    {
        return await PostLifecycleAction(connectUrl, $"/connectors/{connectorName}/tasks/{taskId}/restart", connectorName, $"restart task {taskId}");
    }

    public async Task<ConnectorOperationResult> PauseConnectorAsync(string connectUrl, string connectorName)
    {
        return await PutLifecycleAction(connectUrl, $"/connectors/{connectorName}/pause", connectorName, "pause");
    }

    public async Task<ConnectorOperationResult> ResumeConnectorAsync(string connectUrl, string connectorName)
    {
        return await PutLifecycleAction(connectUrl, $"/connectors/{connectorName}/resume", connectorName, "resume");
    }

    // =========================================================================
    // Cluster Health
    // =========================================================================

    public async Task<ConnectClusterInfoDto?> GetClusterInfoAsync(string connectUrl)
    {
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{connectUrl.TrimEnd('/')}/");
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            return new ConnectClusterInfoDto
            {
                Version = root.TryGetProperty("version", out var v) ? v.GetString() ?? "" : "",
                Commit = root.TryGetProperty("commit", out var c) ? c.GetString() ?? "" : "",
                KafkaClusterId = root.TryGetProperty("kafka_cluster_id", out var k) ? k.GetString() ?? "" : "",
                CollectedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cluster info from {Url}", connectUrl);
            return null;
        }
    }

    public async Task<List<ConnectorPluginDto>> GetPluginsAsync(string connectUrl)
    {
        try
        {
            var client = CreateClient();
            var response = await client.GetAsync($"{connectUrl.TrimEnd('/')}/connector-plugins");
            if (!response.IsSuccessStatusCode) return new();

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            return doc.RootElement.EnumerateArray().Select(el => new ConnectorPluginDto
            {
                Class = el.TryGetProperty("class", out var cls) ? cls.GetString() ?? "" : "",
                Type = el.TryGetProperty("type", out var type) ? type.GetString() ?? "" : "",
                Version = el.TryGetProperty("version", out var ver) ? ver.GetString() : null
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting plugins from {Url}", connectUrl);
            return new();
        }
    }

    public async Task<SyncHealthReportDto> GetHealthReportAsync(string connectUrl)
    {
        var report = new SyncHealthReportDto { CollectedAt = DateTime.UtcNow };

        try
        {
            // Cluster info
            report.Cluster = await GetClusterInfoAsync(connectUrl);
            if (report.Cluster == null)
            {
                report.OverallStatus = "CRITICAL";
                report.Issues.Add(new SyncHealthIssueDto
                {
                    Severity = "CRITICAL",
                    Connector = "cluster",
                    Message = $"Cannot reach Kafka Connect at {connectUrl}"
                });
                return report;
            }

            // Connectors
            report.Connectors = await ListConnectorsAsync(connectUrl);
            report.TotalConnectors = report.Connectors.Count;

            foreach (var conn in report.Connectors)
            {
                report.TotalTasks += conn.TaskCount;
                report.RunningTasks += conn.RunningTasks;
                report.FailedTasks += conn.FailedTasks;

                switch (conn.State)
                {
                    case "RUNNING":
                        report.RunningConnectors++;
                        break;
                    case "FAILED":
                        report.FailedConnectors++;
                        report.Issues.Add(new SyncHealthIssueDto
                        {
                            Severity = "ERROR",
                            Connector = conn.Name,
                            Message = $"Connector '{conn.Name}' is in FAILED state."
                        });
                        break;
                    case "PAUSED":
                        report.PausedConnectors++;
                        report.Issues.Add(new SyncHealthIssueDto
                        {
                            Severity = "WARNING",
                            Connector = conn.Name,
                            Message = $"Connector '{conn.Name}' is PAUSED."
                        });
                        break;
                    default:
                        report.Issues.Add(new SyncHealthIssueDto
                        {
                            Severity = "WARNING",
                            Connector = conn.Name,
                            Message = $"Connector '{conn.Name}' is in state: {conn.State}"
                        });
                        break;
                }

                // Check for failed tasks
                if (conn.FailedTasks > 0)
                {
                    report.Issues.Add(new SyncHealthIssueDto
                    {
                        Severity = "ERROR",
                        Connector = conn.Name,
                        Message = $"Connector '{conn.Name}' has {conn.FailedTasks} failed task(s)."
                    });
                }
            }

            // Determine overall status
            if (report.FailedConnectors > 0 || report.FailedTasks > 0)
                report.OverallStatus = report.FailedConnectors == report.TotalConnectors ? "CRITICAL" : "DEGRADED";
            else if (report.PausedConnectors > 0)
                report.OverallStatus = "DEGRADED";
            else if (report.RunningConnectors > 0)
                report.OverallStatus = "HEALTHY";
            else if (report.TotalConnectors == 0)
                report.OverallStatus = "UNKNOWN";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating health report for {Url}", connectUrl);
            report.OverallStatus = "CRITICAL";
            report.Issues.Add(new SyncHealthIssueDto
            {
                Severity = "CRITICAL",
                Connector = "cluster",
                Message = $"Exception: {ex.Message}"
            });
        }

        return report;
    }

    // =========================================================================
    // Topic Inspection
    // =========================================================================

    public async Task<List<string>> GetConnectorTopicsAsync(string connectUrl, string connectorName)
    {
        var config = await GetConnectorConfigAsync(connectUrl, connectorName);
        if (config != null && config.TryGetValue("topics", out var topics))
            return topics.Split(',').Select(t => t.Trim()).Where(t => !string.IsNullOrEmpty(t)).ToList();
        return new();
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    private HttpClient CreateClient()
    {
        var client = _httpClientFactory.CreateClient("ConnectApi");
        client.Timeout = TimeSpan.FromSeconds(30);
        return client;
    }

    private async Task<ConnectorOperationResult> PostLifecycleAction(
        string connectUrl, string path, string connectorName, string action)
    {
        try
        {
            var client = CreateClient();
            var response = await client.PostAsync($"{connectUrl.TrimEnd('/')}{path}", null);
            return new ConnectorOperationResult
            {
                Success = response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NoContent,
                StatusCode = (int)response.StatusCode,
                Message = response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NoContent
                    ? $"Connector '{connectorName}' {action} succeeded."
                    : $"Failed to {action} connector '{connectorName}'.",
                PerformedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during {Action} for {Connector}", action, connectorName);
            return new ConnectorOperationResult
            {
                Success = false,
                Message = $"Exception during {action}: {ex.Message}",
                ErrorDetail = ex.ToString()
            };
        }
    }

    private async Task<ConnectorOperationResult> PutLifecycleAction(
        string connectUrl, string path, string connectorName, string action)
    {
        try
        {
            var client = CreateClient();
            var response = await client.PutAsync($"{connectUrl.TrimEnd('/')}{path}", null);
            return new ConnectorOperationResult
            {
                Success = response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.Accepted,
                StatusCode = (int)response.StatusCode,
                Message = response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.Accepted
                    ? $"Connector '{connectorName}' {action} succeeded."
                    : $"Failed to {action} connector '{connectorName}'.",
                PerformedAt = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during {Action} for {Connector}", action, connectorName);
            return new ConnectorOperationResult
            {
                Success = false,
                Message = $"Exception during {action}: {ex.Message}",
                ErrorDetail = ex.ToString()
            };
        }
    }
}
