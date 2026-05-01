using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Queries;

public record GetVendorRequestByIdQuery(int Id) : IRequest<VendorRequestDetailDto>;

public class GetVendorRequestByIdQueryHandler(
    IVendorRequestRepository repo,
    ICurrentUserService currentUser) : IRequestHandler<GetVendorRequestByIdQuery, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(GetVendorRequestByIdQuery request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        bool canView =
            currentUser.IsInRole(Roles.Admin) ||
            (currentUser.IsInRole(Roles.Buyer) && entity.CreatedByUserId == userId) ||
            entity.ApprovalSteps.Any(s => s.ApproverUserId == userId);

        if (!canView)
            throw new ForbiddenException();

        return VendorRequestMapper.ToDetailDto(entity);
    }
}

public record GetVendorRequestHistoryQuery() : IRequest<List<VendorRequestDetailDto>>;

public class GetVendorRequestHistoryQueryHandler(
    IVendorRequestRepository repo,
    ICurrentUserService currentUser) : IRequestHandler<GetVendorRequestHistoryQuery, List<VendorRequestDetailDto>>
{
    public async Task<List<VendorRequestDetailDto>> Handle(GetVendorRequestHistoryQuery request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var results = await repo.GetHistoryForApproverAsync(userId, ct);
        return results.Select(VendorRequestMapper.ToDetailDto).ToList();
    }
}
