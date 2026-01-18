using Microsoft.AspNetCore.SignalR;
using Backend.Models;

namespace Backend.Hubs;

public class SasSyncHub : Hub
{
    public async Task JoinSyncSession(string syncId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, syncId);
        await Clients.Caller.SendAsync("JoinedSyncSession", syncId);
    }

    public async Task LeaveSyncSession(string syncId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, syncId);
        await Clients.Caller.SendAsync("LeftSyncSession", syncId);
    }
    
    public async Task JoinManagerSyncSession(int integrationId)
    {
        var groupName = $"manager-sync-{integrationId}";
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        await Clients.Caller.SendAsync("JoinedManagerSyncSession", integrationId);
    }

    public async Task LeaveManagerSyncSession(int integrationId)
    {
        var groupName = $"manager-sync-{integrationId}";
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        await Clients.Caller.SendAsync("LeftManagerSyncSession", integrationId);
    }
}

