using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.Notifications.Commands;
using AndritzVendorPortal.Application.Features.Notifications.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(IMediator mediator) : ControllerBase
{
    // Any authenticated user reads their own notifications.
    [HttpGet]
    public async Task<ActionResult<Result<List<NotificationDto>>>> GetMine() =>
        Ok(Result<List<NotificationDto>>.Ok(await mediator.Send(new GetNotificationsQuery())));

    [HttpPost("{id:int}/read")]
    public async Task<ActionResult<Result>> MarkRead(int id)
    {
        await mediator.Send(new SetNotificationReadCommand(id, true));
        return Ok(Result.Ok("Marked read."));
    }

    [HttpPost("{id:int}/unread")]
    public async Task<ActionResult<Result>> MarkUnread(int id)
    {
        await mediator.Send(new SetNotificationReadCommand(id, false));
        return Ok(Result.Ok("Marked unread."));
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<Result>> MarkAllRead()
    {
        await mediator.Send(new MarkAllNotificationsReadCommand());
        return Ok(Result.Ok("All marked read."));
    }
}
