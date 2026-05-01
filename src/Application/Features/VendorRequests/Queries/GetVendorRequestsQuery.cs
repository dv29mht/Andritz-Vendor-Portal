using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Queries;

public record GetVendorRequestsQuery() : IRequest<List<VendorRequestDetailDto>>;

public class GetVendorRequestsQueryHandler(
    IVendorRequestRepository repo,
    ICurrentUserService currentUser) : IRequestHandler<GetVendorRequestsQuery, List<VendorRequestDetailDto>>
{
    public async Task<List<VendorRequestDetailDto>> Handle(GetVendorRequestsQuery request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();

        IReadOnlyList<Domain.Entities.VendorRequest> results;

        if (currentUser.IsInRole(Roles.Admin))
            results = await repo.GetAllWithDetailsAsync(ct);
        else if (currentUser.IsInRole(Roles.Buyer))
            results = await repo.GetForBuyerAsync(userId, ct);
        else
            results = await repo.GetForApproverAsync(userId, ct);

        return results.Select(VendorRequestMapper.ToDetailDto).ToList();
    }
}
