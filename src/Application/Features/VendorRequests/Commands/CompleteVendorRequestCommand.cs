using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Common.Persistence;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Domain.Services;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record CompleteVendorRequestCommand(int Id, string VendorCode) : IRequest<VendorRequestDetailDto>;

public class CompleteVendorRequestCommandValidator : AbstractValidator<CompleteVendorRequestCommand>
{
    public CompleteVendorRequestCommandValidator()
    {
        RuleFor(x => x.VendorCode).NotEmpty()
            .Matches(ValidationPatterns.VendorCode).WithMessage(ValidationPatterns.VendorCodeError);
    }
}

public class CompleteVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IEmailOutbox outbox,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock) : IRequestHandler<CompleteVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(CompleteVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        if (entity.Status != VendorRequestStatus.PendingFinalApproval)
            throw new BadRequestException("Request must be in PendingFinalApproval status.");

        var userId = currentUser.RequireUserId();
        var step = ApprovalChain.GetPendingStepForUser(entity.ApprovalSteps, userId);
        if (step is null || !step.IsFinalApproval)
            throw new ForbiddenException("No pending final approval step assigned to you for this request.");

        step.Decision = ApprovalDecision.Approved;
        step.Comment = "Final approval granted. Vendor code assigned from SAP.";
        step.DecidedAt = clock.UtcNow;

        entity.VendorCode = request.VendorCode;
        entity.VendorCodeAssignedAt = clock.UtcNow;
        entity.VendorCodeAssignedBy = step.ApproverName;
        entity.Status = VendorRequestStatus.Completed;
        entity.UpdatedAt = clock.UtcNow;

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null)
        {
            var values = EmailValues.ForVendor(
                entity, clock.UtcNow,
                recipientName: buyer.FullName,
                finalApproverName: step.ApproverName,
                buyerName: buyer.FullName);
            var footer = EmailHtmlShell.BuildActionFooter(null, null, portalUrl, "Download Vendor PDF");
            var (s, b) = await templates.RenderAsync(EmailTemplateCodes.BuyerVendorApproved, values, ct, footer);
            outbox.Enqueue(buyer.Email, s, b, entity.Id);
        }

        // The Final Approver no longer receives a "vendor approved" oversight copy
        // (removed at the customer's request) — the buyer is notified above and the
        // record is visible in the console.

        // The completion and its notification commit together — so a vendor-code collision,
        // which rolls this back, cannot leave a "your vendor is approved" mail behind.
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (SqlErrors.IsUniqueConstraintViolation(ex))
        {
            // Only a unique-index collision means the vendor code is taken. Any other
            // DbUpdateException (deadlock, timeout, optimistic-concurrency) must bubble
            // up truthfully instead of telling the approver the code is in use.
            throw new ConflictException(
                $"Vendor code '{request.VendorCode}' was just assigned by a concurrent request. Use a different code.");
        }

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
