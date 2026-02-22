using System.Text.Json;
using System.Text.Json.Serialization;

namespace RadiusSyncService.Services;

/// <summary>
/// Enterprise-grade Kafka Connect connector monitoring service.
/// Reads connector configuration from JSON files and queries the
/// Kafka Connect REST API for live connector/task status.
/// </summary>
public class ConnectorService : IDisposable
{
    private readonly ILogger<ConnectorService> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions;

    // Cache
    private ConnectorFullStatus? _cachedStatus;
    private DateTime _lastCheck = DateTime.MinValue;
    private readonly TimeSpan _cacheDuration = TimeSpan.FromSeconds(10);

    public ConnectorService(ILogger<ConnectorService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(5)
        };
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };
    }

    /// <summary>
    /// Gets the combined connector configuration and live status.
    /// </summary>
    public async Task<ConnectorFullStatus> GetConnectorStatusAsync(bool forceRefresh = false)
    {
        if (!forceRefresh && _cachedStatus != null && DateTime.UtcNow - _lastCheck < _cacheDuration)
            return _cachedStatus;

        var result = new ConnectorFullStatus();

        // 1. Read connector config from JSON file
        try
        {
            result.Config = await ReadConnectorConfigAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read connector config file");
            result.ConfigError = ex.Message;
        }

        // 2. Query Kafka Connect REST API for live status
        var connectUrl = GetConnectUrl();
        result.ConnectUrl = connectUrl;

        try
        {
            // Get list of all connectors
            result.AllConnectors = await GetAllConnectorsAsync(connectUrl);
            result.ConnectReachable = true;

            // Get status for the specific connector
            var connectorName = result.Config?.Name ?? GetConnectorName();
            if (!string.IsNullOrEmpty(connectorName))
            {
                result.ConnectorName = connectorName;
                result.LiveStatus = await GetConnectorLiveStatusAsync(connectUrl, connectorName);
                result.TaskStatuses = await GetConnectorTaskStatusesAsync(connectUrl, connectorName);
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Kafka Connect REST API not reachable at {Url}", connectUrl);
            result.ConnectReachable = false;
            result.ConnectError = $"Cannot reach Kafka Connect at {connectUrl}: {ex.Message}";
        }
        catch (TaskCanceledException)
        {
            result.ConnectReachable = false;
            result.ConnectError = $"Timeout connecting to Kafka Connect at {connectUrl}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to query Kafka Connect status");
            result.ConnectError = ex.Message;
        }

        result.CheckedAt = DateTime.UtcNow;
        _cachedStatus = result;
        _lastCheck = DateTime.UtcNow;

        return result;
    }

    /// <summary>
    /// Deploys or updates the connector configuration to Kafka Connect.
    /// </summary>
    public async Task<ConnectorDeployResult> DeployConnectorAsync()
    {
        var result = new ConnectorDeployResult();

        try
        {
            var config = await ReadConnectorConfigAsync();
            if (config == null)
            {
                result.Success = false;
                result.Message = "No connector configuration file found";
                return result;
            }

            var connectUrl = GetConnectUrl();
            var configJson = await File.ReadAllTextAsync(GetConfigFilePath());

            var content = new StringContent(configJson, System.Text.Encoding.UTF8, "application/json");
            var response = await _httpClient.PutAsync(
                $"{connectUrl}/connectors/{config.Name}/config", content);

            if (!response.IsSuccessStatusCode)
            {
                // Try POST for new connector
                response = await _httpClient.PostAsync(
                    $"{connectUrl}/connectors", content);
            }

            result.Success = response.IsSuccessStatusCode;
            result.StatusCode = (int)response.StatusCode;
            result.Message = response.IsSuccessStatusCode
                ? $"Connector '{config.Name}' deployed successfully"
                : $"Deploy failed: {response.StatusCode} — {await response.Content.ReadAsStringAsync()}";
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Pauses a running connector.
    /// </summary>
    public async Task<ConnectorDeployResult> PauseConnectorAsync(string connectorName)
    {
        return await SendConnectorAction(connectorName, "pause");
    }

    /// <summary>
    /// Resumes a paused connector.
    /// </summary>
    public async Task<ConnectorDeployResult> ResumeConnectorAsync(string connectorName)
    {
        return await SendConnectorAction(connectorName, "resume");
    }

    /// <summary>
    /// Restarts a connector.
    /// </summary>
    public async Task<ConnectorDeployResult> RestartConnectorAsync(string connectorName)
    {
        return await SendConnectorAction(connectorName, "restart");
    }

    /// <summary>
    /// Restarts a specific task of a connector.
    /// </summary>
    public async Task<ConnectorDeployResult> RestartTaskAsync(string connectorName, int taskId)
    {
        var result = new ConnectorDeployResult();
        try
        {
            var connectUrl = GetConnectUrl();
            var response = await _httpClient.PostAsync(
                $"{connectUrl}/connectors/{connectorName}/tasks/{taskId}/restart", null);

            result.Success = response.IsSuccessStatusCode;
            result.StatusCode = (int)response.StatusCode;
            result.Message = response.IsSuccessStatusCode
                ? $"Task {taskId} of '{connectorName}' restarted"
                : $"Restart failed: {response.StatusCode}";
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = ex.Message;
        }

        return result;
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private string GetConnectUrl()
    {
        return _configuration.GetValue<string>("Connector:ConnectUrl")
            ?? "http://localhost:8083";
    }

    private string GetConnectorName()
    {
        return _configuration.GetValue<string>("Connector:ConnectorName")
            ?? "jdbc-sink-workspace_1";
    }

    private string GetConfigFilePath()
    {
        var configPath = _configuration.GetValue<string>("Connector:ConfigPath");
        if (!string.IsNullOrEmpty(configPath) && File.Exists(configPath))
            return configPath;

        // Search common locations
        var searchPaths = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), "jdbc-sink-connector.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "EdgeRuntime", "jdbc-sink-connector.json"),
            "/opt/openradius/edge/jdbc-sink-connector.json",
            "/etc/openradius/jdbc-sink-connector.json"
        };

        foreach (var path in searchPaths)
        {
            if (File.Exists(path))
                return Path.GetFullPath(path);
        }

        throw new FileNotFoundException("jdbc-sink-connector.json not found in any search path");
    }

    private async Task<ConnectorConfig?> ReadConnectorConfigAsync()
    {
        var filePath = GetConfigFilePath();
        _logger.LogDebug("Reading connector config from: {Path}", filePath);

        var json = await File.ReadAllTextAsync(filePath);
        var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var config = new ConnectorConfig
        {
            Name = root.GetProperty("name").GetString() ?? "unknown",
            FilePath = filePath,
            RawConfig = new Dictionary<string, string>()
        };

        if (root.TryGetProperty("config", out var configElement))
        {
            foreach (var prop in configElement.EnumerateObject())
            {
                config.RawConfig[prop.Name] = prop.Value.GetString() ?? prop.Value.ToString();
            }

            config.ConnectorClass = GetConfigValue(config.RawConfig, "connector.class");
            config.TasksMax = GetConfigValue(config.RawConfig, "tasks.max");
            config.Topics = GetConfigValue(config.RawConfig, "topics")
                ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList() ?? new List<string>();
            config.ConnectionUrl = GetConfigValue(config.RawConfig, "connection.url");
            config.InsertMode = GetConfigValue(config.RawConfig, "insert.mode");
            config.DeleteEnabled = GetConfigValue(config.RawConfig, "delete.enabled");
            config.PrimaryKeyMode = GetConfigValue(config.RawConfig, "primary.key.mode");
            config.PrimaryKeyFields = GetConfigValue(config.RawConfig, "primary.key.fields");
            config.AutoCreate = GetConfigValue(config.RawConfig, "auto.create");
            config.AutoEvolve = GetConfigValue(config.RawConfig, "auto.evolve");
            config.ErrorsTolerance = GetConfigValue(config.RawConfig, "errors.tolerance");
            config.DlqTopicName = GetConfigValue(config.RawConfig, "errors.deadletterqueue.topic.name");
            config.SchemaEvolution = GetConfigValue(config.RawConfig, "schema.evolution");
            config.TransformType = GetConfigValue(config.RawConfig, "transforms.route.type");
            config.TransformRegex = GetConfigValue(config.RawConfig, "transforms.route.regex");
            config.TransformReplacement = GetConfigValue(config.RawConfig, "transforms.route.replacement");
        }

        return config;
    }

    private static string? GetConfigValue(Dictionary<string, string> config, string key)
    {
        return config.TryGetValue(key, out var value) ? value : null;
    }

    private async Task<List<string>> GetAllConnectorsAsync(string connectUrl)
    {
        var response = await _httpClient.GetAsync($"{connectUrl}/connectors");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<string>>(json, _jsonOptions) ?? new List<string>();
    }

    private async Task<ConnectorLiveStatus?> GetConnectorLiveStatusAsync(string connectUrl, string connectorName)
    {
        try
        {
            var response = await _httpClient.GetAsync($"{connectUrl}/connectors/{connectorName}/status");
            if (!response.IsSuccessStatusCode)
            {
                return new ConnectorLiveStatus
                {
                    Name = connectorName,
                    ConnectorState = "NOT_FOUND",
                    WorkerId = null
                };
            }

            var json = await response.Content.ReadAsStringAsync();
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var status = new ConnectorLiveStatus
            {
                Name = root.TryGetProperty("name", out var n) ? n.GetString() : connectorName
            };

            if (root.TryGetProperty("connector", out var conn))
            {
                status.ConnectorState = conn.TryGetProperty("state", out var s) ? s.GetString() : "UNKNOWN";
                status.WorkerId = conn.TryGetProperty("worker_id", out var w) ? w.GetString() : null;
            }

            if (root.TryGetProperty("tasks", out var tasks) && tasks.ValueKind == JsonValueKind.Array)
            {
                status.Tasks = new List<ConnectorTaskStatus>();
                foreach (var task in tasks.EnumerateArray())
                {
                    status.Tasks.Add(new ConnectorTaskStatus
                    {
                        Id = task.TryGetProperty("id", out var id) ? id.GetInt32() : 0,
                        State = task.TryGetProperty("state", out var ts) ? ts.GetString() : "UNKNOWN",
                        WorkerId = task.TryGetProperty("worker_id", out var tw) ? tw.GetString() : null,
                        Trace = task.TryGetProperty("trace", out var tt) ? tt.GetString() : null
                    });
                }
            }

            if (root.TryGetProperty("type", out var type))
                status.Type = type.GetString();

            return status;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get status for connector {Name}", connectorName);
            return new ConnectorLiveStatus
            {
                Name = connectorName,
                ConnectorState = "ERROR",
                WorkerId = null,
                Tasks = new List<ConnectorTaskStatus>()
            };
        }
    }

    private async Task<List<ConnectorTaskStatus>> GetConnectorTaskStatusesAsync(string connectUrl, string connectorName)
    {
        // Task statuses are included in the connector status response, but we can also fetch individually
        return new List<ConnectorTaskStatus>(); // Already populated from GetConnectorLiveStatusAsync
    }

    private async Task<ConnectorDeployResult> SendConnectorAction(string connectorName, string action)
    {
        var result = new ConnectorDeployResult();
        try
        {
            var connectUrl = GetConnectUrl();
            var response = await _httpClient.PutAsync(
                $"{connectUrl}/connectors/{connectorName}/{action}", null);

            result.Success = response.IsSuccessStatusCode;
            result.StatusCode = (int)response.StatusCode;
            result.Message = response.IsSuccessStatusCode
                ? $"Connector '{connectorName}' {action} successful"
                : $"{action} failed: {response.StatusCode}";
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = ex.Message;
        }

        return result;
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}

// =============================================================================
// Models
// =============================================================================

public class ConnectorFullStatus
{
    public string? ConnectorName { get; set; }
    public string? ConnectUrl { get; set; }
    public bool ConnectReachable { get; set; }
    public string? ConnectError { get; set; }
    public string? ConfigError { get; set; }
    public DateTime CheckedAt { get; set; }
    public ConnectorConfig? Config { get; set; }
    public ConnectorLiveStatus? LiveStatus { get; set; }
    public List<ConnectorTaskStatus>? TaskStatuses { get; set; }
    public List<string>? AllConnectors { get; set; }
}

public class ConnectorConfig
{
    public string Name { get; set; } = "";
    public string? FilePath { get; set; }
    public string? ConnectorClass { get; set; }
    public string? TasksMax { get; set; }
    public List<string> Topics { get; set; } = new();
    public string? ConnectionUrl { get; set; }
    public string? InsertMode { get; set; }
    public string? DeleteEnabled { get; set; }
    public string? PrimaryKeyMode { get; set; }
    public string? PrimaryKeyFields { get; set; }
    public string? AutoCreate { get; set; }
    public string? AutoEvolve { get; set; }
    public string? ErrorsTolerance { get; set; }
    public string? DlqTopicName { get; set; }
    public string? SchemaEvolution { get; set; }
    public string? TransformType { get; set; }
    public string? TransformRegex { get; set; }
    public string? TransformReplacement { get; set; }
    public Dictionary<string, string> RawConfig { get; set; } = new();
}

public class ConnectorLiveStatus
{
    public string? Name { get; set; }
    public string? ConnectorState { get; set; }
    public string? WorkerId { get; set; }
    public string? Type { get; set; }
    public List<ConnectorTaskStatus>? Tasks { get; set; }
}

public class ConnectorTaskStatus
{
    public int Id { get; set; }
    public string? State { get; set; }
    public string? WorkerId { get; set; }
    public string? Trace { get; set; }
}

public class ConnectorDeployResult
{
    public bool Success { get; set; }
    public int StatusCode { get; set; }
    public string? Message { get; set; }
}
