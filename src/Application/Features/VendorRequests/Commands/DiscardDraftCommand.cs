using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Enums;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

/// <summary>
/// Buyer permanently discards one of their own Draft requests. A draft was never
/// submitted, so there is nothing to preserve — the record and its (unused) approval
/// steps are hard-deleted (ApprovalSteps cascade on delete). Only the owning buyer
/// may discard, and only while the request is still a Draft.
/// </summary>
public record DiscardDraftCommand(int Id) : IRequest<Unit>;

public class DiscardDraftCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    ICurrentUserService currentUser) : IRequestHandler<DiscardDraftCommand, Unit>
{
    public async Task<Unit> Handle(DiscardDraftCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        if (entity.CreatedByUserId != userId)
            throw new ForbiddenException();
        if (entity.Status != VendorRequestStatus.Draft)
            throw new BadRequestException("Only Draft requests can be discarded.");

        repo.Remove(entity);
        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
