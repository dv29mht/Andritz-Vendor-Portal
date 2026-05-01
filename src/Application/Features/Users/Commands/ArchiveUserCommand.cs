using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record ArchiveUserCommand(string Id) : IRequest<Unit>;

public class ArchiveUserCommandHandler(
    IIdentityService identity,
    IApplicationDbContext db,
    IDateTimeProvider clock) : IRequestHandler<ArchiveUserCommand, Unit>
{
    public async Task<Unit> Handle(ArchiveUserCommand request, CancellationToken ct)
    {
        var user = await identity.FindByIdAsync(request.Id)
            ?? throw new NotFoundException("User", request.Id);

        if (string.Equals(user.Email, SystemAccounts.FinalApproverEmail, StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("The Final Approver account cannot be deleted.");

        // Load all currently-pending steps for this user
        var pendingSteps = await db.ApprovalSteps
            .Where(s => s.ApproverUserId == request.Id
                        && s.Decision == ApprovalDecision.Pending
                        && !s.IsDeletedApprover)
            .Include(s => s.VendorRequest)
                .ThenInclude(r => r!.ApprovalSteps)
            .ToListAsync(ct);

        // Block deletion if user is the active approver right now on any request
        var actively = pendingSteps.Where(myStep =>
        {
            if (myStep.VendorRequest is null) return false;
            return !myStep.VendorRequest.ApprovalSteps.Any(s =>
                s.StepOrder < myStep.StepOrder
                && s.Decision == ApprovalDecision.Pending
                && !s.IsDeletedApprover);
        }).ToList();

        if (actively.Count > 0)
        {
            var ids = actively.Select(s => s.VendorRequestId).Distinct().OrderBy(x => x).ToList();
            throw new ConflictException(
                $"This approver is the current active approver on {actively.Count} pending request(s) " +
                $"(IDs: {string.Join(", ", ids)}). Wait for those requests to advance or be reassigned before deleting this user.");
        }

        // Mark future-queued steps as deleted-approver and re-advance affected requests
        foreach (var step in pendingSteps)
        {
            step.IsDeletedApprover = true;
            step.DeletedApproverNote = $"User deleted by Admin on {clock.UtcNow:yyyy-MM-dd HH:mm} UTC";
        }

        var affectedIds = pendingSteps.Select(s => s.VendorRequestId).Distinct().ToList();
        if (affectedIds.Count > 0)
        {
            var affected = await db.VendorRequests
                .Include(r => r.ApprovalSteps)
                .Where(r => affectedIds.Contains(r.Id))
                .ToListAsync(ct);

            foreach (var req in affected)
            {
                if (req.Status == VendorRequestStatus.PendingApproval)
                    ApprovalChain.AdvanceWorkflow(req);
                req.UpdatedAt = clock.UtcNow;
            }
        }

        var (ok, errors) = await identity.ArchiveUserAsync(request.Id);
        if (!ok)
            throw new BadRequestException("Archive failed.", errors);

        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
