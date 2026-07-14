using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Domain.Services;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record ApproveVendorRequestCommand(int Id, string? Comment) : IRequest<VendorRequestDetailDto>;

public class ApproveVendorRequestCommandValidator : AbstractValidator<ApproveVendorRequestCommand>
{
    public ApproveVendorRequestCommandValidator() => RuleFor(x => x.Comment).MaximumLength(500);
}

public class ApproveVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IEmailOutbox outbox,
    IConfiguration config,
    IDateTimeProvider clock,
    IEmailActionTokenService tokens) : IRequestHandler<ApproveVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(ApproveVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        var step = ApprovalChain.GetPendingStepForUser(entity.ApprovalSteps, userId)
            ?? throw new ForbiddenException("No pending approval step assigned to you for this request.");

        if (entity.Status != VendorRequestStatus.PendingApproval)
            throw new BadRequestException("Request is not in an approvable state. Use /complete for final approval.");

        step.Decision = ApprovalDecision.Approved;
        step.Comment = request.Comment;
        step.DecidedAt = clock.UtcNow;

        ApprovalChain.AdvanceWorkflow(entity);
        entity.UpdatedAt = clock.UtcNow;

        // Queue the mail against the post-decision in-memory state, then commit both together.
        // The step rows already exist, so their IDs (which the one-click action tokens embed) are
        // real before the save — no transaction dance needed here.
        //
        // Two approvers racing on the same step both reach this point with Decision=Pending in
        // hand; ApprovalStep.Decision is a concurrency token, so exactly one SaveChanges commits
        // and the other throws DbUpdateConcurrencyException → 409. Neither can double-advance the
        // workflow, and neither can double-send.
        await EnqueueNotificationsAsync(entity, step.ApproverName, ct);

        await db.SaveChangesAsync(ct);

        return VendorRequestMapper.ToDetailDto(entity);
    }

    private async Task EnqueueNotificationsAsync(Domain.Entities.VendorRequest entity, string approvedBy, CancellationToken ct)
    {
        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var summary = VendorRequestMapper.ToSummary(entity);
        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);

        if (entity.Status == VendorRequestStatus.PendingFinalApproval)
        {
            // The Final Approver no longer receives a "pending your approval" email
            // (removed at the customer's request) — they act from the in-app
            // notification bell / Final Approver console instead.

            // Buyer-only progress ping (StepApproved is not part of the editable template
            // catalog — it's an internal progress notice). The admin/Final-Approver oversight
            // copy was removed at the customer's request.
            var (saSubject, saBody) = LegacyEmailTemplates.StepApproved(summary, approvedBy, null, portalUrl);
            if (buyer is not null) outbox.Enqueue(buyer.Email, saSubject, saBody, entity.Id);
        }
        else
        {
            var nextStep = entity.ApprovalSteps
                .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
                .OrderBy(s => s.StepOrder)
                .FirstOrDefault();

            // Buyer-only info ping (StepApproved is internal — not editable). The admin/Final-Approver
            // oversight copy was removed at the customer's request.
            var (infoSubj, infoBody) = LegacyEmailTemplates.StepApproved(summary, approvedBy, nextStep?.ApproverName, portalUrl);
            var infoRecipients = new HashSet<string>();
            if (buyer is not null) infoRecipients.Add(buyer.Email);
            foreach (var r in infoRecipients) outbox.Enqueue(r, infoSubj, infoBody, entity.Id);

            // Next approver: action-required with one-click approve/reject buttons
            if (nextStep is not null)
            {
                var nextUser = await identity.FindByIdAsync(nextStep.ApproverUserId);
                if (nextUser is not null && !infoRecipients.Contains(nextUser.Email))
                {
                    var (approveUrl, rejectUrl) = EmailActionLinks.BuildFor(tokens, config, entity, nextStep);
                    var (subj, body) = LegacyEmailTemplates.StepApproved(summary, approvedBy, nextStep.ApproverName, portalUrl, approveUrl, rejectUrl);
                    outbox.Enqueue(nextUser.Email, subj, body, entity.Id);
                }
            }
        }
    }
}
