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

public record RejectVendorRequestCommand(int Id, string Comment) : IRequest<VendorRequestDetailDto>;

public class RejectVendorRequestCommandValidator : AbstractValidator<RejectVendorRequestCommand>
{
    public RejectVendorRequestCommandValidator()
    {
        RuleFor(x => x.Comment).NotEmpty().MaximumLength(500);
    }
}

public class RejectVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IEmailService email,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IVendorRequestPdfService pdfService) : IRequestHandler<RejectVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(RejectVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        var step = ApprovalChain.GetPendingStepForUser(entity.ApprovalSteps, userId)
            ?? throw new ForbiddenException("No pending approval step assigned to you for this request.");

        step.Decision = ApprovalDecision.Rejected;
        step.Comment = request.Comment;
        step.DecidedAt = clock.UtcNow;
        entity.Status = VendorRequestStatus.Rejected;
        entity.RejectionComment = request.Comment;
        entity.UpdatedAt = clock.UtcNow;

        await db.SaveChangesAsync(ct);

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var pdf = EmailActionLinks.PdfAttachment(pdfService, entity);

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null)
        {
            var values = EmailValues.ForVendor(
                entity, clock.UtcNow,
                recipientName: buyer.FullName,
                approverName: step.ApproverName,
                buyerName: buyer.FullName,
                comments: request.Comment);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "Revise & Resubmit");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.BuyerRejected, values, ct, footer);
            await email.SendAsync(buyer.Email, s, b, pdf);
        }

        // Oversight copy to the elevated account (Final Approver, formerly the admin).
        // Suppressed when the final approver is the actor (rejecting at the final
        // stage) so they don't email themselves.
        var admin = await identity.FindByEmailAsync(SystemAccounts.FinalApproverEmail);
        if (admin is not null && !admin.IsArchived && admin.Id != userId && admin.Email != buyer?.Email)
        {
            // Reuse the BuyerRejected template for the admin notification — the
            // body opens with "[Buyer Name]" but the content is informational for
            // any reviewer copy. Admin gets visibility, not action.
            var values = EmailValues.ForVendor(
                entity, clock.UtcNow,
                recipientName: admin.FullName,
                approverName: step.ApproverName,
                buyerName: entity.CreatedByName,
                comments: request.Comment);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "View in Admin Dashboard");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.BuyerRejected, values, ct, footer);
            await email.SendAsync(admin.Email, s, b, pdf);
        }

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
