using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.Notifications.Commands;

// Set a single notification's read state (true = read, false = unread). Scoped to
// the current user so one user can never mutate another's notifications.
public record SetNotificationReadCommand(int Id, bool IsRead) : IRequest<bool>;

public class SetNotificationReadCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : IRequestHandler<SetNotificationReadCommand, bool>
{
    public async Task<bool> Handle(SetNotificationReadCommand request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();

        var notification = await db.Notifications
            .FirstOrDefaultAsync(n => n.Id == request.Id && n.RecipientUserId == userId, ct)
            ?? throw new NotFoundException(nameof(Notification), request.Id);

        notification.IsRead = request.IsRead;
        await db.SaveChangesAsync(ct);
        return true;
    }
}

// Mark every one of the current user's notifications as read.
public record MarkAllNotificationsReadCommand() : IRequest<bool>;

public class MarkAllNotificationsReadCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : IRequestHandler<MarkAllNotificationsReadCommand, bool>
{
    public async Task<bool> Handle(MarkAllNotificationsReadCommand request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();

        var unread = await db.Notifications
            .Where(n => n.RecipientUserId == userId && !n.IsRead)
            .ToListAsync(ct);

        foreach (var n in unread) n.IsRead = true;
        await db.SaveChangesAsync(ct);
        return true;
    }
}
