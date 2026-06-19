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
    IEmailService email,
    IEmailTemplateService templates,
    IConfiguration config,
    IDateTimeProvider clock,
    IVendorRequestPdfService pdfService) : IRequestHandler<CompleteVendorRequestCommand, VendorRequestDetailDto>
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

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
        {
            // Only a unique-index collision means the vendor code is taken. Any other
            // DbUpdateException (deadlock, timeout, optimistic-concurrency) must bubble
            // up truthfully instead of telling the approver the code is in use.
            throw new ConflictException(
                $"Vendor code '{request.VendorCode}' was just assigned by a concurrent request. Use a different code.");
        }

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var pdf = EmailActionLinks.PdfAttachment(pdfService, entity);

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
            await email.SendAsync(buyer.Email, s, b, pdf);
        }

        // The Final Approver no longer receives a "vendor approved" oversight copy
        // (removed at the customer's request) — the buyer is notified above and the
        // record is visible in the console.

        return VendorRequestMapper.ToDetailDto(entity);
    }

    // SQL Server raises error 2627 (unique constraint) / 2601 (unique index) on a
    // duplicate-key insert/update. The provider exception lives in
    // Microsoft.Data.SqlClient, which the Application layer deliberately does not
    // reference, so read its Number via reflection rather than coupling to the provider.
    private static bool IsUniqueConstraintViolation(DbUpdateException ex)
    {
        if (ex.InnerException?.GetType().GetProperty("Number")?.GetValue(ex.InnerException) is int number)
            return number is 2627 or 2601;
        return false;
    }
}
