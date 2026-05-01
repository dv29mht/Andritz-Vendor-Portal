using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Users.Queries;

public record GetApproversQuery() : IRequest<List<ApproverSummaryDto>>;

public class GetApproversQueryHandler(IIdentityService identity)
    : IRequestHandler<GetApproversQuery, List<ApproverSummaryDto>>
{
    public async Task<List<ApproverSummaryDto>> Handle(GetApproversQuery request, CancellationToken ct)
    {
        var users = await identity.GetUsersInRoleAsync(Roles.Approver);
        return users
            .Where(u => !u.IsArchived)
            .OrderBy(u => u.FullName)
            .Select(u => new ApproverSummaryDto(u.Id, u.FullName, u.Email))
            .ToList();
    }
}
