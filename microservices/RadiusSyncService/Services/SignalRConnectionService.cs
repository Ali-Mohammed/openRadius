using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Text.Json;

namespace RadiusSyncService.Services;

/// <summary>
/// Configuration options for the SignalR hub connection.
/// </summary>
public class SignalRHubOptions
{
    public string HubUrl { get; set; } = "http://localhost:5000/hubs/microservices";
    public int ReconnectDelaySeconds { get; set; } = 5;
    public int HeartbeatIntervalSeconds { get; set; } = 30;
}

/// <summary>
/// Background service that maintains a persistent SignalR connection to the Backend hub.
/// Handles automatic reconnection, heartbeat, and command execution.
/// </summary>
public class SignalRConnectionService : BackgroundService
{
    private readonly ILogger<SignalRConnectionService> _logger;
    private readonly SignalRHubOptions _options;
    private HubConnection? _hubConnection;
    private readonly string _serviceName = "RadiusSyncService";
    private readonly string _serviceVersion = "1.0.0";
    private bool _isRegistered = false;
    private DateTime _connectedAt;
    private DateTime _lastHeartbeat;

    public SignalRConnectionService(
        ILogger<SignalRConnectionService> logger,
        IOptions<SignalRHubOptions> options)
    {
        _logger = logger;
        _options = options.Value;
    }

    public string GetConnectionStatus()
    {
        if (_hubConnection == null)
            return "NotInitialized";
        
        return _hubConnection.State.ToString();
    }

    public object GetDetailedStatus()
    {
        return new
        {
            connectionState = _hubConnection?.State.ToString() ?? "NotInitialized",
            isRegistered = _isRegistered,
            connectedAt = _connectedAt,
            lastHeartbeat = _lastHeartbeat,
            hubUrl = _options.HubUrl
        };
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SignalR Connection Service starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_hubConnection == null || _hubConnection.State == HubConnectionState.Disconnected)
                {
                    await InitializeConnection(stoppingToken);
                }

                if (_hubConnection?.State == HubConnectionState.Connected)
                {
                    await SendHeartbeat();
                }

                await Task.Delay(TimeSpan.FromSeconds(_options.HeartbeatIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("SignalR Connection Service stopping...");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SignalR connection loop");
                await Task.Delay(TimeSpan.FromSeconds(_options.ReconnectDelaySeconds), stoppingToken);
            }
        }

        await DisconnectAsync();
    }

    private async Task InitializeConnection(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Initializing SignalR connection to {HubUrl}", _options.HubUrl);

        _hubConnection = new HubConnectionBuilder()
            .WithUrl(_options.HubUrl)
            .WithAutomaticReconnect(new[] { 
                TimeSpan.FromSeconds(0),
                TimeSpan.FromSeconds(2),
                TimeSpan.FromSeconds(5),
                TimeSpan.FromSeconds(10),
                TimeSpan.FromSeconds(30)
            })
            .ConfigureLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Information);
            })
            .Build();

        // Handle connection events
        _hubConnection.Closed += async (error) =>
        {
            _isRegistered = false;
            _logger.LogWarning(error, "SignalR connection closed");
            await Task.Delay(TimeSpan.FromSeconds(_options.ReconnectDelaySeconds));
        };

        _hubConnection.Reconnecting += (error) =>
        {
            _isRegistered = false;
            _logger.LogWarning(error, "SignalR reconnecting...");
            return Task.CompletedTask;
        };

        _hubConnection.Reconnected += async (connectionId) =>
        {
            _logger.LogInformation("SignalR reconnected with connection ID: {ConnectionId}", connectionId);
            await RegisterWithHub();
        };

        // Register message handlers
        RegisterMessageHandlers();

        // Start the connection
        try
        {
            await _hubConnection.StartAsync(stoppingToken);
            _connectedAt = DateTime.UtcNow;
            _logger.LogInformation("SignalR connected successfully");
            
            // Register this service with the hub
            await RegisterWithHub();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to SignalR hub at {HubUrl}", _options.HubUrl);
            throw;
        }
    }

    private void RegisterMessageHandlers()
    {
        if (_hubConnection == null) return;

        // Handle registration acknowledgment
        _hubConnection.On<object>("RegistrationAcknowledged", (data) =>
        {
            _isRegistered = true;
            _logger.LogInformation("Service registration acknowledged: {Data}", data);
        });

        // Handle ping requests
        _hubConnection.On<JsonElement>("Ping", async (data) =>
        {
            _logger.LogDebug("Received ping: {Data}", data);
            var pingId = data.TryGetProperty("pingId", out var pingIdProp) ? pingIdProp.GetString() ?? "" : "";
            await _hubConnection.InvokeAsync("Pong", _serviceName, pingId);
        });

        // Handle commands from the backend/dashboard
        _hubConnection.On<object>("ExecuteCommand", async (data) =>
        {
            await HandleCommand(data);
        });
    }

    private async Task HandleCommand(object commandData)
    {
        try
        {
            var json = JsonSerializer.Serialize(commandData);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            var command = root.TryGetProperty("command", out var cmdProp) ? cmdProp.GetString() ?? "" : "";
            var payload = root.TryGetProperty("payload", out var payloadProp) ? payloadProp : (JsonElement?)null;

            _logger.LogInformation("Received command: {Command}", command);

            switch (command.ToLower())
            {
                case "sync":
                    await ExecuteSyncCommand(payload);
                    break;
                case "restart":
                    _logger.LogInformation("Restart command received");
                    break;
                case "status":
                    await SendStatusReport();
                    break;
                default:
                    _logger.LogWarning("Unknown command: {Command}", command);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling command");
        }
    }

    private async Task ExecuteSyncCommand(JsonElement? payload)
    {
        var syncType = payload?.TryGetProperty("syncType", out var syncTypeProp) == true ? syncTypeProp.GetString() ?? "full" : "full";
        _logger.LogInformation("Executing sync: {SyncType}", syncType);
        
        await ReportActivity($"Starting {syncType} sync...", 0);
        
        // Simulate sync progress
        for (int i = 0; i <= 100; i += 10)
        {
            await Task.Delay(500);
            await ReportActivity($"Syncing... {i}%", i);
        }
        
        await ReportActivity("Sync completed", 100);
        await SendLog("info", $"Sync completed: {syncType}");
    }

    private async Task RegisterWithHub()
    {
        if (_hubConnection?.State != HubConnectionState.Connected) return;

        try
        {
            var metadata = new Dictionary<string, string>
            {
                { "environment", Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production" },
                { "machineName", Environment.MachineName },
                { "processId", Environment.ProcessId.ToString() },
                { "startTime", Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("O") }
            };

            await _hubConnection.InvokeAsync("RegisterService", _serviceName, _serviceVersion, metadata);
            _logger.LogInformation("Registered with hub as {ServiceName} v{Version}", _serviceName, _serviceVersion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to register with hub");
        }
    }

    private async Task SendHeartbeat()
    {
        if (_hubConnection?.State != HubConnectionState.Connected || !_isRegistered) return;

        try
        {
            var process = Process.GetCurrentProcess();
            var healthReport = new
            {
                isHealthy = true,
                cpuUsage = 0.0, // Would need actual CPU monitoring
                memoryUsageMb = process.WorkingSet64 / (1024.0 * 1024.0),
                activeConnections = 1,
                pendingTasks = 0,
                customMetrics = new Dictionary<string, object>
                {
                    { "uptime", (DateTime.UtcNow - process.StartTime.ToUniversalTime()).TotalSeconds },
                    { "threadCount", process.Threads.Count }
                }
            };

            await _hubConnection.InvokeAsync("Heartbeat", _serviceName, healthReport);
            _lastHeartbeat = DateTime.UtcNow;
            _logger.LogDebug("Heartbeat sent");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send heartbeat");
        }
    }

    private async Task SendStatusReport()
    {
        if (_hubConnection?.State != HubConnectionState.Connected) return;

        await SendLog("info", "Status report requested", GetDetailedStatus());
    }

    public async Task ReportActivity(string activity, double? progress = null)
    {
        if (_hubConnection?.State != HubConnectionState.Connected) return;

        try
        {
            await _hubConnection.InvokeAsync("ReportActivity", _serviceName, activity, progress);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to report activity");
        }
    }

    public async Task SendLog(string level, string message, object? data = null)
    {
        if (_hubConnection?.State != HubConnectionState.Connected) return;

        try
        {
            await _hubConnection.InvokeAsync("SendLog", _serviceName, level, message, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send log");
        }
    }

    private async Task DisconnectAsync()
    {
        if (_hubConnection != null)
        {
            try
            {
                await _hubConnection.StopAsync();
                await _hubConnection.DisposeAsync();
                _logger.LogInformation("SignalR connection disposed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error disposing SignalR connection");
            }
        }
    }
}
