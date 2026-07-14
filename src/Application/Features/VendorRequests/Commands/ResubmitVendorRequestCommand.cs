using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record ResubmitVendorRequestCommand(
    int Id,
    string VendorName,
    string ContactPerson,
    string? Telephone,
    string? Email,
    string GstNumber,
    string? PanCard,
    string AddressDetails,
    string City,
    string? Locality,
    string? MaterialGroup,
    string? PostalCode,
    string? State,
    string? Country,
    string? Currency,
    string? PaymentTerms,
    string? Incoterms,
    string? Reason,
    string? YearlyPvo,
    bool? IsOneTimeVendor,
    string? ProposedBy,
    string? PurchasingOrganization,
    string? MsmeCategory,
    string? BankName,
    string? BranchName,
    string? BankAccountNumber,
    string? IfscCode,
    string? BankDocument1,
    string? BankDocument2,
    string? GstDocument,
    string? PanDocument,
    List<string>? ApproverUserIds) : IRequest<VendorRequestDetailDto>;

public class ResubmitVendorRequestCommandValidator : AbstractValidator<ResubmitVendorRequestCommand>
{
    public ResubmitVendorRequestCommandValidator()
    {
        RuleFor(x => x.VendorName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactPerson).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).MaximumLength(200).EmailAddress()
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
        // GST may be a 15-char Indian GST number or "N/A" for import / foreign vendors.
        RuleFor(x => x.GstNumber).Must(ValidationPatterns.IsGstOrNa).WithMessage(ValidationPatterns.GstError);
        // PAN format validation removed — other countries use different formats. PAN is free-text optional.
        RuleFor(x => x.AddressDetails).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
    }
}

public class ResubmitVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IEmailOutbox outbox,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IEmailActionTokenService tokens) : IRequestHandler<ResubmitVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(ResubmitVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        if (entity.CreatedByUserId != userId) throw new ForbiddenException();
        if (entity.Status != VendorRequestStatus.Rejected)
            throw new BadRequestException("Only Rejected requests can be resubmitted.");

        // GST/PAN uniqueness — the resubmitted values must not collide with another
        // active (non-archived, non-rejected) request. Exclude self.
        if (!string.IsNullOrWhiteSpace(request.GstNumber)
            && await repo.GstNumberExistsAsync(request.GstNumber, entity.Id, ct))
            throw new ConflictException("A request with this GST number already exists.");

        if (!string.IsNullOrWhiteSpace(request.PanCard)
            && await repo.PanCardExistsAsync(request.PanCard, entity.Id, ct))
            throw new ConflictException("A request with this PAN number already exists.");

        // Capture — before the chain is reset/rebuilt — who rejected the prior
        // revision and the existing intermediate chain, so the revision can record
        // the rejecter and any change to the approval chain.
        var rejectedByName = entity.ApprovalSteps
            .FirstOrDefault(s => s.Decision == ApprovalDecision.Rejected)?.ApproverName;

        // Stale-approver check
        var intermediate = entity.ApprovalSteps.Where(s => !s.IsFinalApproval).OrderBy(s => s.StepOrder).ToList();
        var oldChain = intermediate.Select(s => s.ApproverName).ToList();
        var staleNames = new List<string>();
        foreach (var step in intermediate)
        {
            if (await identity.FindByIdAsync(step.ApproverUserId) is null)
                staleNames.Add(step.ApproverName);
        }

        if (staleNames.Count > 0 && request.ApproverUserIds is null)
            throw new ConflictException(
                "One or more approvers in the original chain no longer exist. Please provide a new approval chain.");

        // One transaction spans the chain rewrite (which renumbers steps across two flushes), the
        // revision row, the status change, and the outbox mail — so a resubmission is all-or-nothing.
        await using var tx = await db.BeginTransactionAsync(ct);

        // Chain replacement: a non-null ApproverUserIds list (even empty) means the
        // buyer explicitly set the chain on resubmit — rebuild the intermediate steps
        // from it. An empty list collapses the chain to the Final Approver only.
        // A null list (caller sent nothing) keeps the original chain.
        if (request.ApproverUserIds is not null)
        {
            var newIds = request.ApproverUserIds.Distinct().ToList();
            await ApprovalChainBuilder.ValidateApproversAsync(newIds, identity, ct);

            // Upsert in place rather than delete-then-reinsert — the pattern that collided on
            // IX_ApprovalSteps_VendorRequestId_StepOrder under concurrent writes.
            await ApprovalChainBuilder.RebuildIntermediateAsync(entity, db, newIds, identity, ct);

            var finalStep = entity.ApprovalSteps.First(s => s.IsFinalApproval);
            finalStep.Decision = ApprovalDecision.Pending;
            finalStep.Comment = null;
            finalStep.DecidedAt = null;
        }
        else
        {
            foreach (var s in entity.ApprovalSteps)
            {
                s.Decision = ApprovalDecision.Pending;
                s.Comment = null;
                s.DecidedAt = null;
            }
        }

        var newChain = entity.ApprovalSteps
            .Where(s => !s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .Select(s => s.ApproverName)
            .ToList();

        // Compute diff
        var input = new VendorFieldsInput(
            request.VendorName, request.ContactPerson, request.Telephone, request.Email,
            request.GstNumber, request.PanCard, request.AddressDetails,
            request.City, request.Locality, request.MaterialGroup, request.PostalCode,
            request.State, request.Country, request.Currency, request.PaymentTerms,
            request.Incoterms, request.Reason, request.YearlyPvo,
            request.IsOneTimeVendor, request.ProposedBy,
            request.PurchasingOrganization, request.MsmeCategory,
            request.BankName, request.BranchName, request.BankAccountNumber, request.IfscCode,
            request.BankDocument1, request.BankDocument2, request.GstDocument, request.PanDocument);

        var changes = TrackedFields.ComputeDiff(entity, input);
        // Record an approval-chain change as a normal diff row so it appears in the
        // revision timeline and the CSV/PDF exports alongside the field changes.
        if (!oldChain.SequenceEqual(newChain))
        {
            var oldStr = oldChain.Count == 0 ? "Final Approver only" : string.Join(" → ", oldChain);
            var newStr = newChain.Count == 0 ? "Final Approver only" : string.Join(" → ", newChain);
            changes.Add(new FieldChangeRecord("approvalChain", "Approval Chain", oldStr, newStr));
        }
        var newRevNo = entity.RevisionNo + 1;
        var changedBy = await identity.FindByIdAsync(userId);

        var revision = new VendorRevision
        {
            VendorRequestId = entity.Id,
            RevisionNo = newRevNo,
            ChangedByUserId = userId,
            ChangedByName = changedBy?.FullName ?? string.Empty,
            ChangedAt = clock.UtcNow,
            RevisionType = RevisionType.Resubmit,
            RejectionComment = entity.RejectionComment,
            RejectedByName = rejectedByName,
            ChangesJson = VendorRequestMapper.SerializeChanges(changes)
        };
        db.VendorRevisions.Add(revision);

        TrackedFields.Apply(entity, input);

        entity.RevisionNo = newRevNo;
        entity.RejectionComment = null;
        var hasIntermediate = entity.ApprovalSteps.Any(s => !s.IsFinalApproval);
        entity.Status = hasIntermediate
            ? VendorRequestStatus.PendingApproval
            : VendorRequestStatus.PendingFinalApproval;
        entity.UpdatedAt = clock.UtcNow;

        // The approve/reject links in the mail below embed the new ApprovalStep IDs, which EF only
        // assigns on insert — so unlike the other handlers this one cannot stage its outbox rows
        // before the save. The transaction opened above is what keeps them atomic regardless.
        await db.SaveChangesAsync(ct);

        await EnqueueNotificationsAsync(entity, ct);
        await db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        entity.RevisionHistory.Add(revision);
        return VendorRequestMapper.ToDetailDto(entity);
    }

    private async Task EnqueueNotificationsAsync(VendorRequest entity, CancellationToken ct)
    {
        // Email only the intermediate approver who must act next on the (possibly
        // rebuilt) chain. The Final Approver and the buyer work from the in-app
        // notification bell, not email — matching the submit flow and the
        // customer's request. An approver dropped from the chain on resubmit is no
        // longer a step, so they receive nothing. When the chain is Final-Approver-
        // only (no intermediate steps), no email is sent at all.
        var firstStep = entity.ApprovalSteps
            .Where(s => !s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();
        if (firstStep is null) return;

        var approver = await identity.FindByIdAsync(firstStep.ApproverUserId);
        if (approver is null) return;

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var values = EmailValues.ForVendor(
            entity, clock.UtcNow,
            recipientName: firstStep.ApproverName,
            approverName: firstStep.ApproverName,
            buyerName: entity.CreatedByName);
        var (approveUrl, rejectUrl) = EmailActionLinks.BuildFor(tokens, config, entity, firstStep);
        var footer = EmailHtmlShell.BuildActionFooter(approveUrl, rejectUrl, portalUrl, "View in Portal");
        var (s, b) = await templates.RenderAsync(EmailTemplateCodes.ApproverResubmitted, values, ct, footer);
        outbox.Enqueue(approver.Email, s, b, entity.Id);
    }
}
