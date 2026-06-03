using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Common.Time;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record PurgeUserCommand(string Id) : IRequest<Unit>;

public class PurgeUserCommandHandler(
    IIdentityService identity,
    IApplicationDbContext db,
    IDateTimeProvider clock,
    ILoginSecurityService loginSecurity) : IRequestHandler<PurgeUserCommand, Unit>
{
    public async Task<Unit> Handle(PurgeUserCommand request, CancellationToken ct)
    {
        var user = await identity.FindByIdAsync(request.Id)
            ?? throw new NotFoundException("User", request.Id);

        if (string.Equals(user.Email, SystemAccounts.FinalApproverEmail, StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("The Final Approver account cannot be deleted.");

        // Same safety net as Archive: a hard delete must not strand a request whose
        // current active approver is the user being removed, and queued steps must be
        // released so downstream requests can still advance.
        var pendingSteps = await db.ApprovalSteps
            .Where(s => s.ApproverUserId == request.Id
                        && s.Decision == ApprovalDecision.Pending
                        && !s.IsDeletedApprover)
            .Include(s => s.VendorRequest)
                .ThenInclude(r => r!.ApprovalSteps)
            .ToListAsync(ct);

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

        foreach (var step in pendingSteps)
        {
            step.IsDeletedApprover = true;
            step.DeletedApproverNote = $"User permanently deleted by Admin on {IstTime.FormatIso(clock.UtcNow)}";
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

        // Revoke before the hard delete. LoginSecurity rows are keyed by user id with
        // no FK back to AspNetUsers, so they survive the delete and keep rejecting any
        // JWT this account still holds (its iat is now older than TokensValidSince).
        // Without this, a purged user's outstanding token authenticates until it expires.
        var rolesToRevoke = await identity.GetRolesAsync(request.Id);

        await db.SaveChangesAsync(ct);

        if (rolesToRevoke.Count > 0)
            await loginSecurity.RevokeAllAsync(request.Id, rolesToRevoke, ct);

        var (ok, errors) = await identity.PurgeUserAsync(request.Id);
        if (!ok)
            throw new BadRequestException("Purge failed.", errors);

        return Unit.Value;
    }
}
