using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.Notifications.Queries;

public record GetNotificationsQuery() : IRequest<List<NotificationDto>>;

public class GetNotificationsQueryHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser) : IRequestHandler<GetNotificationsQuery, List<NotificationDto>>
{
    public async Task<List<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();

        return await db.Notifications
            .Where(n => n.RecipientUserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(100)
            .Select(n => new NotificationDto(
                n.Id, n.VendorRequestId, n.Type, n.Title, n.Body, n.IsRead, n.CreatedAt))
            .ToListAsync(ct);
    }
}
