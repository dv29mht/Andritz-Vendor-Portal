using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record SubmitVendorRequestCommand(int Id) : IRequest<VendorRequestDetailDto>;

public class SubmitVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IEmailOutbox outbox,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IEmailActionTokenService tokens) : IRequestHandler<SubmitVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(SubmitVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        if (entity.CreatedByUserId != userId)
            throw new ForbiddenException();
        if (entity.Status != VendorRequestStatus.Draft)
            throw new BadRequestException("Only Draft requests can be submitted via this endpoint. Use /resubmit for Rejected requests.");

        var hasIntermediate = entity.ApprovalSteps.Any(s => !s.IsFinalApproval);
        entity.Status = hasIntermediate
            ? VendorRequestStatus.PendingApproval
            : VendorRequestStatus.PendingFinalApproval;
        entity.UpdatedAt = clock.UtcNow;

        // Notifications — only the approver who must act receives an email.
        // The buyer's submission-confirmation email and the admin/Final-Approver
        // oversight copy were removed at the customer's request (the in-app
        // notification bell still covers both of them).
        //
        // The mail is queued, not sent: it commits with the status change below and the
        // dispatcher delivers it (and renders the PDF) off the request thread.
        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";

        var firstStep = entity.ApprovalSteps
            .Where(s => hasIntermediate ? !s.IsFinalApproval : s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        // Per the customer's request, the Final Approver no longer receives a
        // "pending your approval" email on submission — they act from the in-app
        // notification bell / console. Only an intermediate approver who must act
        // first is emailed here; when there is no intermediate approver, no email
        // is sent on submit.
        if (firstStep is not null && !firstStep.IsFinalApproval)
        {
            var approver = await identity.FindByIdAsync(firstStep.ApproverUserId);
            if (approver is not null)
            {
                var values = EmailValues.ForVendor(
                    entity, clock.UtcNow,
                    recipientName: firstStep.ApproverName,
                    approverName: firstStep.ApproverName,
                    finalApproverName: null,
                    buyerName: entity.CreatedByName);

                var (approveUrl, rejectUrl) = EmailActionLinks.BuildFor(tokens, config, entity, firstStep);
                var footer = EmailHtmlShell.BuildActionFooter(approveUrl, rejectUrl, portalUrl, "View in Portal");

                var (s, b) = await templates.RenderAsync(EmailTemplateCodes.ApproverApprovalRequest, values, ct, footer);
                outbox.Enqueue(approver.Email, s, b, entity.Id);
            }
        }

        await db.SaveChangesAsync(ct);

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
