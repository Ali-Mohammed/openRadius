using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.Models;
using Backend.Services;

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
    private readonly ApplicationDbContext _appDbContext;
    private readonly MasterDbContext _masterDbContext;
    private readonly MicroserviceApprovalService _approvalService;

    public MicroservicesHub(ILogger<MicroservicesHub> logger, ApplicationDbContext appDbContext, MasterDbContext masterDbContext, MicroserviceApprovalService approvalService)
    {
        _logger = logger;
        _appDbContext = appDbContext;
        _masterDbContext = masterDbContext;
        _approvalService = approvalService;
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
    /// Validates approval before allowing registration.
    /// </summary>
    public async Task RegisterService(string serviceName, string version, string machineId, string approvalToken, Dictionary<string, string>? metadata = null)
    {
        var connectionId = Context.ConnectionId;
        var httpContext = Context.GetHttpContext();
        var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString() ?? "Unknown";
        var userAgent = httpContext?.Request?.Headers["User-Agent"].ToString() ?? "Unknown";

        // Validate approval
        var isApproved = await _approvalService.ValidateConnectionAsync(serviceName, machineId, approvalToken);
        
        if (!isApproved)
        {
            _logger.LogWarning("Microservice registration rejected: {ServiceName} (Machine: {MachineId})", serviceName, machineId);
            
            // Check if this is a new request or existing pending/revoked
            var existingApproval = await _approvalService.GetApprovalByMachineAsync(serviceName, machineId);
            
            if (existingApproval == null)
            {
                // First time connection - request approval
                var machineName = metadata?.GetValueOrDefault("MachineName") ?? "Unknown";
                var platform = metadata?.GetValueOrDefault("Platform") ?? "Unknown";
                var token = await _approvalService.RequestApprovalAsync(serviceName, machineId, machineName, platform);
                
                await Clients.Caller.SendAsync("RegistrationRejected", new
                {
                    reason = "Approval required",
                    status = "pending",
                    message = "This microservice connection requires approval. Please contact an administrator.",
                    approvalToken = token
                });
                
                // Notify dashboard about pending approval
                await Clients.Group("dashboard").SendAsync("PendingApprovalRequest", new
                {
                    serviceName,
                    machineId,
                    machineName,
                    platform,
                    requestedAt = DateTime.UtcNow
                });
            }
            else if (existingApproval.IsRevoked)
            {
                await Clients.Caller.SendAsync("RegistrationRejected", new
                {
                    reason = "Connection revoked",
                    status = "revoked",
                    message = "This microservice connection has been revoked. Please contact an administrator."
                });
            }
            else
            {
                await Clients.Caller.SendAsync("RegistrationRejected", new
                {
                    reason = "Awaiting approval",
                    status = "pending",
                    message = "This microservice connection is awaiting approval.",
                    approvalToken = existingApproval.ApprovalToken
                });
            }
            
            // Don't abort - let the client handle the rejection gracefully
            return;
        }
        
        var serviceInfo = new MicroserviceInfo
        {
            ServiceName = serviceName,
            Version = version,
            ConnectionId = connectionId,
            ConnectedAt = DateTime.UtcNow,
            LastHeartbeat = DateTime.UtcNow,
            Status = ServiceStatus.Online,
            ApprovalStatus = ApprovalStatus.Approved, // Set to Approved since validation passed
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata ?? new Dictionary<string, string>()
        };

        // Add machine ID to metadata
        serviceInfo.Metadata["MachineId"] = machineId;

        // Get and add approval ID
        var approval = await _approvalService.GetApprovalByMachineAsync(serviceName, machineId);
        if (approval != null)
        {
            serviceInfo.Metadata["ApprovalId"] = approval.Id.ToString();
            // Set display name from approval if available
            if (!string.IsNullOrEmpty(approval.DisplayName))
            {
                serviceInfo.DisplayName = approval.DisplayName;
            }
        }

        ConnectedServices.AddOrUpdate(serviceName, serviceInfo, (_, _) => serviceInfo);
        
        // Update last connected time
        await _approvalService.UpdateLastConnectedAsync(serviceName, machineId);
        
        // Add the service to its own group for targeted messaging
        await Groups.AddToGroupAsync(connectionId, $"service-{serviceName}");
        
        _logger.LogInformation("Microservice registered: {ServiceName} v{Version} ({ConnectionId}) - Machine: {MachineId}", 
            serviceName, version, connectionId, machineId);
        
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
    public async Task<List<object>> GetConnectedServices()
    {
        var services = new List<object>();
        
        foreach (var serviceInfo in ConnectedServices.Values)
        {
            // Ensure approval ID is in metadata if not already there
            if (!serviceInfo.Metadata.ContainsKey("ApprovalId"))
            {
                var machineId = serviceInfo.Metadata.GetValueOrDefault("MachineId");
                if (!string.IsNullOrEmpty(machineId))
                {
                    var approval = await _approvalService.GetApprovalByMachineAsync(serviceInfo.ServiceName, machineId);
                    if (approval != null)
                    {
                        serviceInfo.Metadata["ApprovalId"] = approval.Id.ToString();
                    }
                }
            }
            
            services.Add(GetServiceStatus(serviceInfo));
        }
        
        return services;
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
    /// Approve a pending microservice connection.
    /// </summary>
    public async Task ApproveService(string serviceName, string displayName)
    {
        if (ConnectedServices.TryGetValue(serviceName, out var serviceInfo))
        {
            serviceInfo.ApprovalStatus = ApprovalStatus.Approved;
            serviceInfo.Status = ServiceStatus.Online;
            serviceInfo.DisplayName = displayName;
            
            // Save to database
            try
            {
                var approvedService = await _masterDbContext.ApprovedMicroservices
                    .FirstOrDefaultAsync(s => s.ServiceId == serviceName);
                
                if (approvedService == null)
                {
                    approvedService = new ApprovedMicroservice
                    {
                        ServiceId = serviceName,
                        DisplayName = displayName,
                        ApprovedAt = DateTime.UtcNow,
                        ApprovedBy = Context.ConnectionId, // Could be improved with actual user context
                        LastConnectedAt = serviceInfo.ConnectedAt,
                        LastIpAddress = serviceInfo.IpAddress,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _masterDbContext.ApprovedMicroservices.Add(approvedService);
                }
                else
                {
                    approvedService.DisplayName = displayName;
                    approvedService.LastConnectedAt = serviceInfo.ConnectedAt;
                    approvedService.LastIpAddress = serviceInfo.IpAddress;
                    approvedService.IsActive = true;
                    approvedService.UpdatedAt = DateTime.UtcNow;
                }
                
                await _masterDbContext.SaveChangesAsync();
                
                _logger.LogInformation("Service approved and saved to database: {ServiceName} as {DisplayName}", 
                    serviceName, displayName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save approved service to database: {ServiceName}", serviceName);
            }
            
            // Notify the service that it's been approved
            await Clients.Client(serviceInfo.ConnectionId).SendAsync("Approved");
            
            // Notify all dashboards
            await Clients.Group("dashboard").SendAsync("ServiceApproved", GetServiceStatus(serviceInfo));
        }
    }

    /// <summary>
    /// Reject a pending microservice connection.
    /// </summary>
    public async Task RejectService(string serviceName)
    {
        if (ConnectedServices.TryGetValue(serviceName, out var serviceInfo))
        {
            serviceInfo.ApprovalStatus = ApprovalStatus.Rejected;
            serviceInfo.Status = ServiceStatus.Offline;
            
            // Notify the service that it's been rejected
            await Clients.Client(serviceInfo.ConnectionId).SendAsync("Rejected");
            
            // Disconnect the service
            ConnectedServices.TryRemove(serviceName, out _);
            
            // Notify all dashboards
            await Clients.Group("dashboard").SendAsync("ServiceRejected", serviceName);
            
            _logger.LogInformation("Service rejected: {ServiceName}", serviceName);
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

    #region Docker Management

    /// <summary>
    /// Request Docker status from a specific microservice.
    /// </summary>
    public async Task RequestDockerStatus(string serviceName)
    {
        await SendCommand(serviceName, "docker-status", null);
        _logger.LogInformation("Docker status requested from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Request Docker installation guide from a specific microservice.
    /// </summary>
    public async Task RequestDockerInstallGuide(string serviceName)
    {
        await SendCommand(serviceName, "docker-install-guide", null);
        _logger.LogInformation("Docker installation guide requested from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Request to install Docker on a specific microservice.
    /// </summary>
    public async Task RequestDockerInstall(string serviceName)
    {
        await SendCommand(serviceName, "docker-install", null);
        _logger.LogInformation("Docker installation requested on {ServiceName}", serviceName);
    }

    /// <summary>
    /// Request to start Docker on a specific microservice.
    /// </summary>
    public async Task RequestDockerStart(string serviceName)
    {
        await SendCommand(serviceName, "docker-start", null);
        _logger.LogInformation("Docker start requested from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Request to stop a container on a specific microservice.
    /// </summary>
    public async Task RequestContainerStop(string serviceName, string containerId)
    {
        await SendCommand(serviceName, "docker-container-stop", new { containerId });
        _logger.LogInformation("Container stop requested: {ContainerId} on {ServiceName}", containerId, serviceName);
    }

    /// <summary>
    /// Request to start a container on a specific microservice.
    /// </summary>
    public async Task RequestContainerStart(string serviceName, string containerId)
    {
        await SendCommand(serviceName, "docker-container-start", new { containerId });
        _logger.LogInformation("Container start requested: {ContainerId} on {ServiceName}", containerId, serviceName);
    }

    /// <summary>
    /// Request to remove a container on a specific microservice.
    /// </summary>
    public async Task RequestContainerRemove(string serviceName, string containerId, bool force = false)
    {
        await SendCommand(serviceName, "docker-container-remove", new { containerId, force });
        _logger.LogInformation("Container remove requested: {ContainerId} on {ServiceName}", containerId, serviceName);
    }

    /// <summary>
    /// Request container logs from a specific microservice.
    /// </summary>
    public async Task RequestContainerLogs(string serviceName, string containerId, int? tail = null)
    {
        await SendCommand(serviceName, "docker-container-logs", new { containerId, tail });
        _logger.LogInformation("Container logs requested: {ContainerId} on {ServiceName}", containerId, serviceName);
    }

    /// <summary>
    /// Request to pull an image on a specific microservice.
    /// </summary>
    public async Task RequestImagePull(string serviceName, string image)
    {
        await SendCommand(serviceName, "docker-image-pull", new { image });
        _logger.LogInformation("Image pull requested: {Image} on {ServiceName}", image, serviceName);
    }

    /// <summary>
    /// Request to run docker-compose up on a specific microservice.
    /// </summary>
    public async Task RequestComposeUp(string serviceName, string composePath, bool detached = true, bool build = false)
    {
        await SendCommand(serviceName, "docker-compose-up", new { composePath, detached, build });
        _logger.LogInformation("Docker compose up requested: {Path} on {ServiceName}", composePath, serviceName);
    }

    /// <summary>
    /// Request to run docker-compose down on a specific microservice.
    /// </summary>
    public async Task RequestComposeDown(string serviceName, string composePath, bool removeVolumes = false)
    {
        await SendCommand(serviceName, "docker-compose-down", new { composePath, removeVolumes });
        _logger.LogInformation("Docker compose down requested: {Path} on {ServiceName}", composePath, serviceName);
    }

    /// <summary>
    /// Request to prune Docker resources on a specific microservice.
    /// </summary>
    public async Task RequestDockerPrune(string serviceName, bool all = false, bool volumes = false)
    {
        await SendCommand(serviceName, "docker-prune", new { all, volumes });
        _logger.LogInformation("Docker prune requested on {ServiceName}", serviceName);
    }

    /// <summary>
    /// Called by microservice to report Docker status.
    /// </summary>
    public async Task ReportDockerStatus(string serviceName, object dockerStatus)
    {
        await Clients.Group("dashboard").SendAsync("DockerStatus", new
        {
            serviceName,
            dockerStatus,
            reportedAt = DateTime.UtcNow
        });
        _logger.LogDebug("Docker status reported from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Called by microservice to report Docker installation guide.
    /// </summary>
    public async Task ReportDockerInstallGuide(string serviceName, object installGuide)
    {
        await Clients.Group("dashboard").SendAsync("DockerInstallGuide", new
        {
            serviceName,
            installGuide,
            reportedAt = DateTime.UtcNow
        });
        _logger.LogDebug("Docker installation guide reported from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Called by microservice to report Docker installation progress.
    /// </summary>
    public async Task ReportDockerInstallProgress(string serviceName, object progressData)
    {
        await Clients.Group("dashboard").SendAsync("DockerInstallProgress", new
        {
            serviceName,
            progressData,
            reportedAt = DateTime.UtcNow
        });
        _logger.LogDebug("Docker installation progress reported from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Called by microservice to report Docker installation result.
    /// </summary>
    public async Task ReportDockerInstallResult(string serviceName, object installResult)
    {
        await Clients.Group("dashboard").SendAsync("DockerInstallResult", new
        {
            serviceName,
            installResult,
            reportedAt = DateTime.UtcNow
        });
        _logger.LogInformation("Docker installation result reported from {ServiceName}", serviceName);
    }

    /// <summary>
    /// Called by microservice to report container logs.
    /// </summary>
    public async Task ReportContainerLogs(string serviceName, string containerId, object logsData)
    {
        await Clients.Group("dashboard").SendAsync("ContainerLogs", new
        {
            serviceName,
            containerId,
            logsData,
            reportedAt = DateTime.UtcNow
        });
    }

    #endregion

    #region Approval Management

    /// <summary>
    /// Get all pending microservice approval requests.
    /// </summary>
    public async Task<List<MicroserviceApproval>> GetPendingApprovals()
    {
        return await _approvalService.GetPendingApprovalsAsync();
    }

    /// <summary>
    /// Get all approved microservice connections.
    /// </summary>
    public async Task<List<MicroserviceApproval>> GetApprovedConnections()
    {
        return await _approvalService.GetApprovedConnectionsAsync();
    }

    /// <summary>
    /// Approve a pending microservice connection.
    /// </summary>
    public async Task<bool> ApproveConnection(int approvalId, string displayName)
    {
        var approval = await _appDbContext.MicroserviceApprovals.FindAsync(approvalId);
        if (approval == null) return false;
        
        var result = await _approvalService.ApproveConnectionAsync(approvalId, "Admin", displayName);
        
        if (result)
        {
            // Update the display name in the connected service if it's connected
            var connectedService = ConnectedServices.Values.FirstOrDefault(s => 
                s.ServiceName == approval.ServiceName && 
                s.Metadata.GetValueOrDefault("MachineId") == approval.MachineId);
            
            if (connectedService != null)
            {
                connectedService.DisplayName = displayName;
            }
            
            _logger.LogInformation("Microservice connection approved: ID {ApprovalId} with display name {DisplayName}", approvalId, displayName);
            
            var approvalData = new
            {
                approvalId,
                serviceName = approval.ServiceName,
                machineId = approval.MachineId,
                displayName,
                status = "approved",
                approvedAt = DateTime.UtcNow
            };
            
            // Notify all clients (including pending microservices waiting for approval)
            await Clients.All.SendAsync("ApprovalUpdated", approvalData);
            
            // Also send to specific service group if it exists
            await Clients.Group($"service-{approval.ServiceName}").SendAsync("ApprovalUpdated", approvalData);
        }
        
        return result;
    }

    /// <summary>
    /// Revoke an approved microservice connection.
    /// </summary>
    public async Task<bool> RevokeConnection(int approvalId)
    {
        var approval = await _appDbContext.MicroserviceApprovals.FindAsync(approvalId);
        if (approval == null) return false;
        
        var result = await _approvalService.RevokeConnectionAsync(approvalId);
        
        if (result)
        {
            _logger.LogInformation("Microservice connection revoked: ID {ApprovalId}", approvalId);
            
            var revocationData = new
            {
                approvalId,
                serviceName = approval.ServiceName,
                machineId = approval.MachineId,
                status = "revoked",
                revokedAt = DateTime.UtcNow
            };
            
            // Notify all clients (including the revoked microservice)
            await Clients.All.SendAsync("ApprovalUpdated", revocationData);
            
            // Force disconnect the service if it's connected
            var connectedService = ConnectedServices.FirstOrDefault(x => x.Key == approval.ServiceName);
            if (!string.IsNullOrEmpty(connectedService.Key))
            {
                ConnectedServices.TryRemove(connectedService.Key, out _);
            }
        }
        
        return result;
    }

    /// <summary>
    /// Delete a microservice approval - service will show as pending again on next connection.
    /// </summary>
    public async Task<bool> DeleteConnection(int approvalId)
    {
        var approval = await _appDbContext.MicroserviceApprovals.FindAsync(approvalId);
        if (approval == null) return false;
        
        var result = await _approvalService.DeleteApprovalAsync(approvalId);
        
        if (result)
        {
            _logger.LogInformation("Microservice approval deleted: ID {ApprovalId} for {ServiceName}", approvalId, approval.ServiceName);
            
            var deletionData = new
            {
                approvalId,
                serviceName = approval.ServiceName,
                machineId = approval.MachineId,
                status = "deleted",
                deletedAt = DateTime.UtcNow
            };
            
            // Notify all clients about the deletion
            await Clients.All.SendAsync("ApprovalDeleted", deletionData);
            
            // Force disconnect the service if it's connected
            var connectedService = ConnectedServices.FirstOrDefault(x => x.Key == approval.ServiceName);
            if (!string.IsNullOrEmpty(connectedService.Key))
            {
                ConnectedServices.TryRemove(connectedService.Key, out _);
                
                // Notify about service disconnection
                await Clients.Group("dashboard").SendAsync("ServiceDisconnected", new
                {
                    serviceName = approval.ServiceName,
                    connectionId = connectedService.Value.ConnectionId,
                    disconnectedAt = DateTime.UtcNow
                });
            }
        }
        
        return result;
    }

    #endregion

    private static object GetServiceStatus(MicroserviceInfo info) => new
    {
        serviceName = info.ServiceName,
        displayName = info.DisplayName,
        version = info.Version,
        connectionId = info.ConnectionId,
        status = info.Status.ToString(),
        approvalStatus = info.ApprovalStatus.ToString(),
        connectedAt = info.ConnectedAt,
        lastHeartbeat = info.LastHeartbeat,
        ipAddress = info.IpAddress,
        userAgent = info.UserAgent,
        currentActivity = info.CurrentActivity,
        activityProgress = info.ActivityProgress,
        healthReport = info.HealthReport,
        metadata = info.Metadata
    };
}

public class MicroserviceInfo
{
    public string ServiceName { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Version { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public DateTime ConnectedAt { get; set; }
    public DateTime LastHeartbeat { get; set; }
    public ServiceStatus Status { get; set; }
    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Pending;
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
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

public enum ApprovalStatus
{
    Pending,
    Approved,
    Rejected
}
