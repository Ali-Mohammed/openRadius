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
    private readonly DockerService _dockerService;
    private HubConnection? _hubConnection;
    private readonly string _serviceName = "RadiusSyncService";
    private readonly string _serviceVersion = "1.0.0";
    private bool _isRegistered = false;
    private DateTime _connectedAt;
    private DateTime _lastHeartbeat;

    public SignalRConnectionService(
        ILogger<SignalRConnectionService> logger,
        IOptions<SignalRHubOptions> options,
        DockerService dockerService)
    {
        _logger = logger;
        _options = options.Value;
        _dockerService = dockerService;
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
                case "docker-status":
                    await ExecuteDockerStatusCommand();
                    break;
                case "docker-install-guide":
                    await ExecuteDockerInstallGuideCommand();
                    break;
                case "docker-start":
                    await ExecuteDockerStartCommand();
                    break;
                case "docker-container-stop":
                    await ExecuteDockerContainerStopCommand(payload);
                    break;
                case "docker-container-remove":
                    await ExecuteDockerContainerRemoveCommand(payload);
                    break;
                case "docker-container-logs":
                    await ExecuteDockerContainerLogsCommand(payload);
                    break;
                case "docker-image-pull":
                    await ExecuteDockerImagePullCommand(payload);
                    break;
                case "docker-compose-up":
                    await ExecuteDockerComposeUpCommand(payload);
                    break;
                case "docker-compose-down":
                    await ExecuteDockerComposeDownCommand(payload);
                    break;
                case "docker-prune":
                    await ExecuteDockerPruneCommand(payload);
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

    #region Docker Commands

    private async Task ExecuteDockerStatusCommand()
    {
        _logger.LogInformation("Executing Docker status check...");
        await ReportActivity("Checking Docker status...", 0);
        
        try
        {
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            await ReportActivity("Docker status retrieved", 100);
            
            // Send the Docker status to the dashboard
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
            
            await SendLog("info", "Docker status check completed", status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Docker status");
            await SendLog("error", $"Docker status check failed: {ex.Message}");
        }
    }

    private async Task ExecuteDockerInstallGuideCommand()
    {
        _logger.LogInformation("Getting Docker installation guide...");
        
        try
        {
            var guide = _dockerService.GetInstallationGuide();
            
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerInstallGuide", _serviceName, guide);
            }
            
            await SendLog("info", "Docker installation guide retrieved", guide);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Docker installation guide");
            await SendLog("error", $"Failed to get installation guide: {ex.Message}");
        }
    }

    private async Task ExecuteDockerStartCommand()
    {
        _logger.LogInformation("Attempting to start Docker...");
        await ReportActivity("Starting Docker...", 0);
        
        try
        {
            var result = await _dockerService.StartDockerAsync();
            
            if (result.Success)
            {
                await ReportActivity("Docker start command sent", 50);
                await SendLog("info", "Docker start command executed successfully");
                
                // Wait a bit for Docker to initialize
                await Task.Delay(5000);
                
                // Check status again
                var status = await _dockerService.GetStatusAsync(forceRefresh: true);
                await ReportActivity("Docker status checked", 100);
                
                if (_hubConnection?.State == HubConnectionState.Connected)
                {
                    await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
                }
            }
            else
            {
                await SendLog("error", $"Failed to start Docker: {result.Error}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start Docker");
            await SendLog("error", $"Failed to start Docker: {ex.Message}");
        }
    }

    private async Task ExecuteDockerContainerStopCommand(JsonElement? payload)
    {
        var containerId = payload?.TryGetProperty("containerId", out var idProp) == true ? idProp.GetString() ?? "" : "";
        
        if (string.IsNullOrEmpty(containerId))
        {
            await SendLog("error", "Container ID is required");
            return;
        }
        
        _logger.LogInformation("Stopping container: {ContainerId}", containerId);
        await ReportActivity($"Stopping container {containerId}...", 0);
        
        try
        {
            var result = await _dockerService.StopContainerAsync(containerId);
            
            if (result.Success)
            {
                await SendLog("info", $"Container {containerId} stopped successfully");
                await ReportActivity($"Container {containerId} stopped", 100);
            }
            else
            {
                await SendLog("error", $"Failed to stop container: {result.Error}");
            }
            
            // Refresh status
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop container");
            await SendLog("error", $"Failed to stop container: {ex.Message}");
        }
    }

    private async Task ExecuteDockerContainerRemoveCommand(JsonElement? payload)
    {
        var containerId = payload?.TryGetProperty("containerId", out var idProp) == true ? idProp.GetString() ?? "" : "";
        var force = payload?.TryGetProperty("force", out var forceProp) == true && forceProp.GetBoolean();
        
        if (string.IsNullOrEmpty(containerId))
        {
            await SendLog("error", "Container ID is required");
            return;
        }
        
        _logger.LogInformation("Removing container: {ContainerId}, Force: {Force}", containerId, force);
        await ReportActivity($"Removing container {containerId}...", 0);
        
        try
        {
            var result = await _dockerService.RemoveContainerAsync(containerId, force);
            
            if (result.Success)
            {
                await SendLog("info", $"Container {containerId} removed successfully");
                await ReportActivity($"Container {containerId} removed", 100);
            }
            else
            {
                await SendLog("error", $"Failed to remove container: {result.Error}");
            }
            
            // Refresh status
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove container");
            await SendLog("error", $"Failed to remove container: {ex.Message}");
        }
    }

    private async Task ExecuteDockerContainerLogsCommand(JsonElement? payload)
    {
        var containerId = payload?.TryGetProperty("containerId", out var idProp) == true ? idProp.GetString() ?? "" : "";
        var tail = payload?.TryGetProperty("tail", out var tailProp) == true ? tailProp.GetInt32() : (int?)null;
        
        if (string.IsNullOrEmpty(containerId))
        {
            await SendLog("error", "Container ID is required");
            return;
        }
        
        _logger.LogInformation("Getting logs for container: {ContainerId}", containerId);
        
        try
        {
            var result = await _dockerService.GetContainerLogsAsync(containerId, tail ?? 100);
            
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportContainerLogs", _serviceName, containerId, new
                {
                    success = result.Success,
                    logs = result.Output,
                    error = result.Error
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get container logs");
            await SendLog("error", $"Failed to get container logs: {ex.Message}");
        }
    }

    private async Task ExecuteDockerImagePullCommand(JsonElement? payload)
    {
        var image = payload?.TryGetProperty("image", out var imageProp) == true ? imageProp.GetString() ?? "" : "";
        
        if (string.IsNullOrEmpty(image))
        {
            await SendLog("error", "Image name is required");
            return;
        }
        
        _logger.LogInformation("Pulling image: {Image}", image);
        await ReportActivity($"Pulling image {image}...", 0);
        
        try
        {
            var result = await _dockerService.PullImageAsync(image);
            
            if (result.Success)
            {
                await SendLog("info", $"Image {image} pulled successfully");
                await ReportActivity($"Image {image} pulled", 100);
            }
            else
            {
                await SendLog("error", $"Failed to pull image: {result.Error}");
            }
            
            // Refresh status
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to pull image");
            await SendLog("error", $"Failed to pull image: {ex.Message}");
        }
    }

    private async Task ExecuteDockerComposeUpCommand(JsonElement? payload)
    {
        var composePath = payload?.TryGetProperty("composePath", out var pathProp) == true ? pathProp.GetString() ?? "" : "";
        var detached = payload?.TryGetProperty("detached", out var detachedProp) != true || detachedProp.GetBoolean();
        var build = payload?.TryGetProperty("build", out var buildProp) == true && buildProp.GetBoolean();
        
        if (string.IsNullOrEmpty(composePath))
        {
            await SendLog("error", "Compose file path is required");
            return;
        }
        
        _logger.LogInformation("Running docker compose up: {Path}", composePath);
        await ReportActivity("Starting docker compose...", 0);
        
        try
        {
            var result = await _dockerService.ComposeUpAsync(composePath, detached, build);
            
            if (result.Success)
            {
                await SendLog("info", $"Docker compose up completed for {composePath}");
                await ReportActivity("Docker compose started", 100);
            }
            else
            {
                await SendLog("error", $"Docker compose up failed: {result.Error}");
            }
            
            // Refresh status
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run docker compose up");
            await SendLog("error", $"Failed to run docker compose: {ex.Message}");
        }
    }

    private async Task ExecuteDockerComposeDownCommand(JsonElement? payload)
    {
        var composePath = payload?.TryGetProperty("composePath", out var pathProp) == true ? pathProp.GetString() ?? "" : "";
        var removeVolumes = payload?.TryGetProperty("removeVolumes", out var volProp) == true && volProp.GetBoolean();
        
        if (string.IsNullOrEmpty(composePath))
        {
            await SendLog("error", "Compose file path is required");
            return;
        }
        
        _logger.LogInformation("Running docker compose down: {Path}", composePath);
        await ReportActivity("Stopping docker compose...", 0);
        
        try
        {
            var result = await _dockerService.ComposeDownAsync(composePath, removeVolumes);
            
            if (result.Success)
            {
                await SendLog("info", $"Docker compose down completed for {composePath}");
                await ReportActivity("Docker compose stopped", 100);
            }
            else
            {
                await SendLog("error", $"Docker compose down failed: {result.Error}");
            }
            
            // Refresh status
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run docker compose down");
            await SendLog("error", $"Failed to run docker compose down: {ex.Message}");
        }
    }

    private async Task ExecuteDockerPruneCommand(JsonElement? payload)
    {
        var all = payload?.TryGetProperty("all", out var allProp) == true && allProp.GetBoolean();
        var volumes = payload?.TryGetProperty("volumes", out var volProp) == true && volProp.GetBoolean();
        
        _logger.LogInformation("Running docker system prune: All={All}, Volumes={Volumes}", all, volumes);
        await ReportActivity("Pruning Docker resources...", 0);
        
        try
        {
            var result = await _dockerService.PruneSystemAsync(all, volumes);
            
            if (result.Success)
            {
                await SendLog("info", "Docker prune completed", new { output = result.Output });
                await ReportActivity("Docker prune completed", 100);
            }
            else
            {
                await SendLog("error", $"Docker prune failed: {result.Error}");
            }
            
            // Refresh status
            var status = await _dockerService.GetStatusAsync(forceRefresh: true);
            if (_hubConnection?.State == HubConnectionState.Connected)
            {
                await _hubConnection.InvokeAsync("ReportDockerStatus", _serviceName, status);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to run docker prune");
            await SendLog("error", $"Failed to run docker prune: {ex.Message}");
        }
    }

    #endregion

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
                { "startTime", Process.GetCurrentProcess().StartTime.ToUniversalTime().ToString("O") },
                { "osVersion", Environment.OSVersion.ToString() },
                { "platform", Environment.OSVersion.Platform.ToString() },
                { "dotnetVersion", Environment.Version.ToString() },
                { "workingDirectory", Environment.CurrentDirectory },
                { "userName", Environment.UserName }
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
