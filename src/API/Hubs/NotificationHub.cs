using AndritzVendorPortal.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AndritzVendorPortal.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        // The elevated user (Final Approver, who now also holds every former admin
        // capability) joins a shared group so workflow events on any request reach
        // them without enumerating user IDs. Group name kept as "admins" so the
        // SignalRNotificationService broadcast target is unchanged.
        if (Context.User?.IsInRole(Roles.FinalApprover) == true)
            await Groups.AddToGroupAsync(Context.ConnectionId, "admins");

        await base.OnConnectedAsync();
    }
}
