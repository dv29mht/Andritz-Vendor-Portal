using AndritzVendorPortal.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AndritzVendorPortal.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // Admins join a shared group so workflow events on any request reach all
        // admins without enumerating user IDs.
        if (Context.User?.IsInRole(Roles.Admin) == true)
            await Groups.AddToGroupAsync(Context.ConnectionId, "admins");

        await base.OnConnectedAsync();
    }
}
