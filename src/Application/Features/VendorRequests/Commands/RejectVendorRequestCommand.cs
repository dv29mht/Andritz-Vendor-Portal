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

        // The Final Approver does NOT receive a rejection email — a rejection needs
        // action only from the buyer (revise & resubmit). The Final Approver still
        // gets an in-app bell notification (see NotificationBehavior), per the
        // customer's rule that they work from the bell rather than email.

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
