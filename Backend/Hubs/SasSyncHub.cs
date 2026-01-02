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
}
