using AndritzVendorPortal.API.Hubs;
using AndritzVendorPortal.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace AndritzVendorPortal.API.Services;

public class SignalRNotificationService(IHubContext<NotificationHub> hub) : INotificationService
{
    public async Task BroadcastWorkflowChangeAsync(int requestId, IEnumerable<string> userIds, CancellationToken ct = default)
    {
        var payload = new { id = requestId };
        await hub.Clients.Users(userIds).SendAsync("workflowChanged", payload, ct);
        await hub.Clients.Group("admins").SendAsync("workflowChanged", payload, ct);
    }
}
