using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace Backend.Hubs;

/// <summary>
/// SignalR Hub for managing microservice connections and communication.
/// Provides real-time monitoring, health checks, and bidirectional communication
/// with connected microservices like RadiusSyncService.
/// </summary>
public class MicroservicesHub : Hub
{
    private static readonly ConcurrentDictionary<string, MicroserviceInfo> ConnectedServices = new();
    private static readonly ConcurrentDictionary<string, DateTime> PendingPings = new();
    private readonly ILogger<MicroservicesHub> _logger;

    public MicroservicesHub(ILogger<MicroservicesHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Called when a microservice connects to the hub.
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("New connection attempt: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Called when a microservice disconnects from the hub.
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        
        // Find and remove the disconnected service
        var serviceEntry = ConnectedServices.FirstOrDefault(x => x.Value.ConnectionId == connectionId);
        if (!string.IsNullOrEmpty(serviceEntry.Key))
        {
            ConnectedServices.TryRemove(serviceEntry.Key, out _);
            _logger.LogInformation("Microservice disconnected: {ServiceName} ({ConnectionId})", 
                serviceEntry.Key, connectionId);
            
            // Notify all frontend clients about the disconnection
            await Clients.Group("dashboard").SendAsync("ServiceDisconnected", new
            {
                serviceName = serviceEntry.Key,
                connectionId = connectionId,
                disconnectedAt = DateTime.UtcNow
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Registers a microservice with the hub. Called by microservices on startup.
    /// </summary>
    public async Task RegisterService(string serviceName, string version, Dictionary<string, string>? metadata = null)
    {
        var connectionId = Context.ConnectionId;
        
        var serviceInfo = new MicroserviceInfo
        {
            ServiceName = serviceName,
            Version = version,
            ConnectionId = connectionId,
            ConnectedAt = DateTime.UtcNow,
            LastHeartbeat = DateTime.UtcNow,
            Status = ServiceStatus.Online,
            Metadata = metadata ?? new Dictionary<string, string>()
        };

        ConnectedServices.AddOrUpdate(serviceName, serviceInfo, (_, _) => serviceInfo);
        
        // Add the service to its own group for targeted messaging
        await Groups.AddToGroupAsync(connectionId, $"service-{serviceName}");
        
        _logger.LogInformation("Microservice registered: {ServiceName} v{Version} ({ConnectionId})", 
            serviceName, version, connectionId);
        
        // Acknowledge registration to the service
        await Clients.Caller.SendAsync("RegistrationAcknowledged", new
        {
            serviceName,
            connectionId,
            registeredAt = serviceInfo.ConnectedAt
        });

        // Notify all frontend clients about the new connection
        await Clients.Group("dashboard").SendAsync("ServiceConnected", GetServiceStatus(serviceInfo));
    }

    /// <summary>
    /// Heartbeat from a microservice to indicate it's still alive and healthy.
    /// </summary>
    public async Task Heartbeat(string serviceName, ServiceHealthReport healthReport)
    {
        if (ConnectedServices.TryGetValue(serviceName, out var serviceInfo))
        {
            serviceInfo.LastHeartbeat = DateTime.UtcNow;
            serviceInfo.Status = healthReport.IsHealthy ? ServiceStatus.Online : ServiceStatus.Degraded;
            serviceInfo.HealthReport = healthReport;
            
            // Notify dashboard clients of the heartbeat
            await Clients.Group("dashboard").SendAsync("ServiceHeartbeat", new
            {
                serviceName,
                status = serviceInfo.Status.ToString(),
                lastHeartbeat = serviceInfo.LastHeartbeat,
                healthReport
            });
        }
    }

    /// <summary>
    /// Allows a microservice to report its current activity/task.
    /// </summary>
    public async Task ReportActivity(string serviceName, string activity, double? progress = null)
    {
        if (ConnectedServices.TryGetValue(serviceName, out var serviceInfo))
        {
            serviceInfo.CurrentActivity = activity;
            serviceInfo.ActivityProgress = progress;
            
            await Clients.Group("dashboard").SendAsync("ServiceActivity", new
            {
                serviceName,
                activity,
                progress,
                timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Allows a microservice to send a log entry to the dashboard.
    /// </summary>
    public async Task SendLog(string serviceName, string level, string message, object? data = null)
    {
        await Clients.Group("dashboard").SendAsync("ServiceLog", new
        {
            serviceName,
            level,
            message,
            data,
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Frontend clients join this group to receive service updates.
    /// </summary>
    public async Task JoinDashboard()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "dashboard");
        
        // Send current state of all services to the newly joined client
        var services = ConnectedServices.Values.Select(GetServiceStatus).ToList();
        await Clients.Caller.SendAsync("InitialState", new { services });
        
        _logger.LogInformation("Dashboard client joined: {ConnectionId}", Context.ConnectionId);
    }

    /// <summary>
    /// Frontend clients leave the dashboard group.
    /// </summary>
    public async Task LeaveDashboard()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "dashboard");
    }

    /// <summary>
    /// Send a command to a specific microservice.
    /// </summary>
    public async Task SendCommand(string serviceName, string command, object? payload = null)
    {
        if (ConnectedServices.TryGetValue(serviceName, out var serviceInfo))
        {
            await Clients.Client(serviceInfo.ConnectionId).SendAsync("ExecuteCommand", new
            {
                command,
                payload,
                requestedAt = DateTime.UtcNow,
                requestedBy = Context.ConnectionId
            });
            
            _logger.LogInformation("Command sent to {ServiceName}: {Command}", serviceName, command);
        }
        else
        {
            await Clients.Caller.SendAsync("CommandError", new
            {
                serviceName,
                command,
                error = "Service not connected"
            });
        }
    }

    /// <summary>
    /// Request a specific microservice to perform a sync operation.
    /// </summary>
    public async Task RequestSync(string serviceName, string syncType, object? options = null)
    {
        await SendCommand(serviceName, "sync", new { syncType, options });
    }

    /// <summary>
    /// Get the current status of all connected services.
    /// </summary>
    public Task<List<object>> GetConnectedServices()
    {
        var services = ConnectedServices.Values.Select(GetServiceStatus).ToList();
        return Task.FromResult(services);
    }

    /// <summary>
    /// Ping a specific service to check if it's responsive.
    /// </summary>
    public async Task PingService(string serviceName)
    {
        if (ConnectedServices.TryGetValue(serviceName, out var serviceInfo))
        {
            var pingId = Guid.NewGuid().ToString();
            PendingPings.TryAdd(pingId, DateTime.UtcNow);
            
            await Clients.Client(serviceInfo.ConnectionId).SendAsync("Ping", new
            {
                pingId,
                timestamp = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// Response from a service after being pinged.
    /// </summary>
    public async Task Pong(string serviceName, string pingId)
    {
        var latencyMs = 0.0;
        
        if (PendingPings.TryRemove(pingId, out var pingTime))
        {
            latencyMs = (DateTime.UtcNow - pingTime).TotalMilliseconds;
        }
        
        await Clients.Group("dashboard").SendAsync("PingResult", new
        {
            serviceName,
            pingId,
            latencyMs,
            responseTime = DateTime.UtcNow
        });
    }

    private static object GetServiceStatus(MicroserviceInfo info) => new
    {
        serviceName = info.ServiceName,
        version = info.Version,
        connectionId = info.ConnectionId,
        status = info.Status.ToString(),
        connectedAt = info.ConnectedAt,
        lastHeartbeat = info.LastHeartbeat,
        currentActivity = info.CurrentActivity,
        activityProgress = info.ActivityProgress,
        healthReport = info.HealthReport,
        metadata = info.Metadata
    };
}

public class MicroserviceInfo
{
    public string ServiceName { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public DateTime ConnectedAt { get; set; }
    public DateTime LastHeartbeat { get; set; }
    public ServiceStatus Status { get; set; }
    public string? CurrentActivity { get; set; }
    public double? ActivityProgress { get; set; }
    public ServiceHealthReport? HealthReport { get; set; }
    public Dictionary<string, string> Metadata { get; set; } = new();
}

public class ServiceHealthReport
{
    public bool IsHealthy { get; set; }
    public double CpuUsage { get; set; }
    public double MemoryUsageMb { get; set; }
    public int ActiveConnections { get; set; }
    public int PendingTasks { get; set; }
    public Dictionary<string, object>? CustomMetrics { get; set; }
}

public enum ServiceStatus
{
    Online,
    Offline,
    Degraded,
    Maintenance
}
