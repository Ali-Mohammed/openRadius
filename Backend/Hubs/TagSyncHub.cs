using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs;

public class TagSyncHub : Hub
{
    public async Task JoinTagSync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "TagSync");
    }

    public async Task LeaveTagSync()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "TagSync");
    }
}
