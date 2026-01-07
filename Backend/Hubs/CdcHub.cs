using Microsoft.AspNetCore.SignalR;

namespace Backend.Hubs;

public class CdcHub : Hub
{
    public async Task SubscribeToTopic(string topicName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, topicName);
        await Clients.Caller.SendAsync("Subscribed", topicName);
    }

    public async Task UnsubscribeFromTopic(string topicName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, topicName);
        await Clients.Caller.SendAsync("Unsubscribed", topicName);
    }
}
