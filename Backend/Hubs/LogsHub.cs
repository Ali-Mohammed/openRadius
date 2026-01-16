using Microsoft.AspNetCore.SignalR;
using Backend.Models;
using Backend.Services;

namespace Backend.Hubs;

public class LogsHub : Hub
{
    private readonly IFreeRadiusLogService _logService;
    private readonly ILogger<LogsHub> _logger;

    public LogsHub(IFreeRadiusLogService logService, ILogger<LogsHub> logger)
    {
        _logService = logService;
        _logger = logger;
    }

    public async Task SubscribeToLogs(string logType)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"logs_{logType}");
        _logger.LogInformation("Client {ConnectionId} subscribed to {LogType} logs", Context.ConnectionId, logType);
    }

    public async Task UnsubscribeFromLogs(string logType)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"logs_{logType}");
        _logger.LogInformation("Client {ConnectionId} unsubscribed from {LogType} logs", Context.ConnectionId, logType);
    }

    public async Task StartLogStreaming(LogFilter filter)
    {
        try
        {
            _logger.LogInformation("Starting log streaming for client {ConnectionId}", Context.ConnectionId);
            
            // Send initial logs
            var logs = await _logService.GetLogsAsync(filter);
            await Clients.Caller.SendAsync("LogsUpdate", logs);

            // Add to streaming group
            await Groups.AddToGroupAsync(Context.ConnectionId, "streaming");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start log streaming");
            await Clients.Caller.SendAsync("LogError", ex.Message);
        }
    }

    public async Task StopLogStreaming()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "streaming");
        _logger.LogInformation("Client {ConnectionId} stopped log streaming", Context.ConnectionId);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client {ConnectionId} disconnected", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
