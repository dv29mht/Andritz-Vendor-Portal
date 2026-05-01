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

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw new ConflictException(
                $"Vendor code '{request.VendorCode}' was just assigned by a concurrent request. Use a different code.");
        }

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var summary = VendorRequestMapper.ToSummary(entity);
        var (subj, body) = EmailTemplates.Completed(summary, request.VendorCode, step.ApproverName, portalUrl);

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null) await email.SendAsync(buyer.Email, subj, body);
        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);
        if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
            await email.SendAsync(admin.Email, subj, body);

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
