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
    IEmailService email,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IVendorRequestPdfService pdfService,
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

        await db.SaveChangesAsync(ct);

        await SendNotificationsAsync(entity, step.ApproverName, ct);
        return VendorRequestMapper.ToDetailDto(entity);
    }

    private async Task SendNotificationsAsync(Domain.Entities.VendorRequest entity, string approvedBy, CancellationToken ct)
    {
        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var summary = VendorRequestMapper.ToSummary(entity);
        var pdf = EmailActionLinks.PdfAttachment(pdfService, entity);
        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);

        if (entity.Status == VendorRequestStatus.PendingFinalApproval)
        {
            // Build the list of intermediate approvers who have approved so far.
            var intermediateApprovedNames = string.Join(", ",
                entity.ApprovalSteps
                    .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Approved)
                    .OrderBy(s => s.StepOrder)
                    .Select(s => s.ApproverName));

            // Notify FinalApprover via the editable template, with a reject-only token
            // (approval requires entering the SAP code in the portal).
            var finalStep = entity.ApprovalSteps.FirstOrDefault(s => s.IsFinalApproval);
            if (finalStep is not null)
            {
                var finalUser = await identity.FindByIdAsync(finalStep.ApproverUserId);
                if (finalUser is not null)
                {
                    var values = EmailValues.ForVendor(
                        entity, clock.UtcNow,
                        recipientName: finalStep.ApproverName,
                        finalApproverName: finalStep.ApproverName,
                        buyerName: entity.CreatedByName,
                        intermediateApproverNames: intermediateApprovedNames);
                    var rejectUrl = EmailActionLinks.BuildRejectOnly(tokens, config, entity, finalStep);
                    var footer = EmailHtmlShell.BuildActionFooter(null, rejectUrl, portalUrl, "Review & Assign SAP Code");
                    var (s, b) = await templates.RenderAsync(EmailTemplateCodes.FinalApproverPending, values, ct, footer);
                    await email.SendAsync(finalUser.Email, s, b, pdf);
                }
            }

            // Buyer + admin: keep the existing intermediate-approval notice (StepApproved is
            // not part of the editable template catalog — it's an internal progress ping).
            var (saSubject, saBody) = LegacyEmailTemplates.StepApproved(summary, approvedBy, null, portalUrl);
            if (buyer is not null) await email.SendAsync(buyer.Email, saSubject, saBody, pdf);
            if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
                await email.SendAsync(admin.Email, saSubject, saBody, pdf);
        }
        else
        {
            var nextStep = entity.ApprovalSteps
                .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
                .OrderBy(s => s.StepOrder)
                .FirstOrDefault();

            // Buyer + admin: info-only progress ping (StepApproved is internal — not editable)
            var (infoSubj, infoBody) = LegacyEmailTemplates.StepApproved(summary, approvedBy, nextStep?.ApproverName, portalUrl);
            var infoRecipients = new HashSet<string>();
            if (buyer is not null) infoRecipients.Add(buyer.Email);
            if (admin is not null && !admin.IsArchived) infoRecipients.Add(admin.Email);
            foreach (var r in infoRecipients) await email.SendAsync(r, infoSubj, infoBody, pdf);

            // Next approver: action-required with one-click approve/reject buttons
            if (nextStep is not null)
            {
                var nextUser = await identity.FindByIdAsync(nextStep.ApproverUserId);
                if (nextUser is not null && !infoRecipients.Contains(nextUser.Email))
                {
                    var (approveUrl, rejectUrl) = EmailActionLinks.BuildFor(tokens, config, entity, nextStep);
                    var (subj, body) = LegacyEmailTemplates.StepApproved(summary, approvedBy, nextStep.ApproverName, portalUrl, approveUrl, rejectUrl);
                    await email.SendAsync(nextUser.Email, subj, body, pdf);
                }
            }
        }
    }
}
