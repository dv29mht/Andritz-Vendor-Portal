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
        RuleFor(x => x.GstNumber).NotEmpty().Matches(ValidationPatterns.Gst).WithMessage(ValidationPatterns.GstError);
        RuleFor(x => x.PanCard)
            .Matches(ValidationPatterns.Pan).WithMessage(ValidationPatterns.PanError)
            .When(x => !string.IsNullOrWhiteSpace(x.PanCard));
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
    IEmailService email,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IVendorRequestPdfService pdfService,
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

        // Stale-approver check
        var intermediate = entity.ApprovalSteps.Where(s => !s.IsFinalApproval).OrderBy(s => s.StepOrder).ToList();
        var staleNames = new List<string>();
        foreach (var step in intermediate)
        {
            if (await identity.FindByIdAsync(step.ApproverUserId) is null)
                staleNames.Add(step.ApproverName);
        }

        if (staleNames.Count > 0 && (request.ApproverUserIds is null || request.ApproverUserIds.Count == 0))
            throw new ConflictException(
                "One or more approvers in the original chain no longer exist. Please provide a new approval chain.");

        // Optional chain replacement
        if (request.ApproverUserIds is { Count: > 0 })
        {
            var newIds = request.ApproverUserIds.Distinct().ToList();
            await ApprovalChainBuilder.ValidateApproversAsync(newIds, identity, ct);

            var finalStep = entity.ApprovalSteps.First(s => s.IsFinalApproval);
            foreach (var s in intermediate) db.ApprovalSteps.Remove(s);

            int stepOrder = 1;
            foreach (var aid in newIds)
            {
                var u = await identity.FindByIdAsync(aid);
                entity.ApprovalSteps.Add(new ApprovalStep
                {
                    ApproverUserId = aid,
                    ApproverName = u!.FullName,
                    StepOrder = stepOrder++,
                    IsFinalApproval = false
                });
            }

            finalStep.StepOrder = stepOrder;
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

        // Compute diff
        var input = new VendorFieldsInput(
            request.VendorName, request.ContactPerson, request.Telephone,
            request.GstNumber, request.PanCard, request.AddressDetails,
            request.City, request.Locality, request.MaterialGroup, request.PostalCode,
            request.State, request.Country, request.Currency, request.PaymentTerms,
            request.Incoterms, request.Reason, request.YearlyPvo,
            request.IsOneTimeVendor, request.ProposedBy,
            request.PurchasingOrganization, request.MsmeCategory,
            request.BankName, request.BranchName, request.BankAccountNumber, request.IfscCode,
            request.BankDocument1, request.BankDocument2, request.GstDocument, request.PanDocument);

        var changes = TrackedFields.ComputeDiff(entity, input);
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

        await db.SaveChangesAsync(ct);

        await SendNotificationsAsync(entity, ct);
        entity.RevisionHistory.Add(revision);
        return VendorRequestMapper.ToDetailDto(entity);
    }

    private async Task SendNotificationsAsync(VendorRequest entity, CancellationToken ct)
    {
        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var pdf = EmailActionLinks.PdfAttachment(pdfService, entity);

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null)
        {
            var values = EmailValues.ForVendor(
                entity, clock.UtcNow,
                recipientName: buyer.FullName,
                buyerName: buyer.FullName);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "Track Request");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.BuyerResubmissionConfirmation, values, ct, footer);
            await email.SendAsync(buyer.Email, s, b);
        }

        var hasIntermediate = entity.ApprovalSteps.Any(s => !s.IsFinalApproval);
        var firstStep = entity.ApprovalSteps
            .Where(s => hasIntermediate ? !s.IsFinalApproval : s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        if (firstStep is not null)
        {
            var approver = await identity.FindByIdAsync(firstStep.ApproverUserId);
            if (approver is not null)
            {
                var values = EmailValues.ForVendor(
                    entity, clock.UtcNow,
                    recipientName: firstStep.ApproverName,
                    approverName: firstStep.ApproverName,
                    buyerName: entity.CreatedByName);

                string footer;
                if (firstStep.IsFinalApproval)
                {
                    var rejectUrl = EmailActionLinks.BuildRejectOnly(tokens, config, entity, firstStep);
                    footer = EmailHtmlShell.BuildActionFooter(null, rejectUrl, portalUrl, "Review & Assign SAP Code");
                }
                else
                {
                    var (approveUrl, rejectUrl) = EmailActionLinks.BuildFor(tokens, config, entity, firstStep);
                    footer = EmailHtmlShell.BuildActionFooter(approveUrl, rejectUrl, portalUrl, "View in Portal");
                }

                var (s, b) = await templates.RenderAsync(EmailTemplateCodes.ApproverResubmitted, values, ct, footer);
                await email.SendAsync(approver.Email, s, b, pdf);
            }
        }

        // Oversight copy to the elevated account (Final Approver, formerly the admin).
        var admin = await identity.FindByEmailAsync(SystemAccounts.FinalApproverEmail);
        if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
        {
            var values = EmailValues.ForVendor(
                entity, clock.UtcNow,
                recipientName: admin.FullName,
                approverName: admin.FullName,
                buyerName: entity.CreatedByName);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "View in Admin Dashboard");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.ApproverResubmitted, values, ct, footer);
            await email.SendAsync(admin.Email, s, b, pdf);
        }
    }
}
