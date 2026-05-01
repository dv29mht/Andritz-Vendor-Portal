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
    IConfiguration config,
    IDateTimeProvider clock) : IRequestHandler<RejectVendorRequestCommand, VendorRequestDetailDto>
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
        var summary = VendorRequestMapper.ToSummary(entity);
        var (subj, body) = EmailTemplates.Rejected(summary, step.ApproverName, request.Comment, portalUrl);

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null) await email.SendAsync(buyer.Email, subj, body);
        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);
        if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
            await email.SendAsync(admin.Email, subj, body);

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
