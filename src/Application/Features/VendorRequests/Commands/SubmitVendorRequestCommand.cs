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
    IEmailService email,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IVendorRequestPdfService pdfService,
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

        await db.SaveChangesAsync(ct);

        // Notifications — buyer + first approver + admin
        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var pdf = EmailActionLinks.PdfAttachment(pdfService, entity);

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null)
        {
            var values = EmailValues.ForVendor(entity, clock.UtcNow, recipientName: buyer.FullName);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "Track Request");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.BuyerRequestSubmitted, values, ct, footer);
            await email.SendAsync(buyer.Email, s, b);
        }

        var firstStep = entity.ApprovalSteps
            .Where(s => hasIntermediate ? !s.IsFinalApproval : s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        if (firstStep is not null)
        {
            var approver = await identity.FindByIdAsync(firstStep.ApproverUserId);
            if (approver is not null)
            {
                var code = firstStep.IsFinalApproval
                    ? EmailTemplateCodes.FinalApproverPending
                    : EmailTemplateCodes.ApproverApprovalRequest;
                var values = EmailValues.ForVendor(
                    entity, clock.UtcNow,
                    recipientName: firstStep.ApproverName,
                    approverName: firstStep.ApproverName,
                    finalApproverName: firstStep.IsFinalApproval ? firstStep.ApproverName : null,
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

                var (s, b) = await templates.RenderAsync(code, values, ct, footer);
                await email.SendAsync(approver.Email, s, b, pdf);
            }
        }

        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);
        if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
        {
            var values = EmailValues.ForVendor(entity, clock.UtcNow, buyerName: entity.CreatedByName);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "View in Admin Dashboard");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.AdminNewVendorRequest, values, ct, footer);
            await email.SendAsync(admin.Email, s, b, pdf);
        }

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
