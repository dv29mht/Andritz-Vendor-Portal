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
    IConfiguration config,
    IDateTimeProvider clock) : IRequestHandler<SubmitVendorRequestCommand, VendorRequestDetailDto>
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
        var summary = VendorRequestMapper.ToSummary(entity);

        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        if (buyer is not null)
        {
            var (s, b) = EmailTemplates.SubmissionConfirmed(summary, portalUrl);
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
                var (s, b) = EmailTemplates.NewSubmission(summary, firstStep.ApproverName, portalUrl);
                await email.SendAsync(approver.Email, s, b);
            }
        }

        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);
        if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
        {
            var (s, b) = EmailTemplates.NewSubmission(summary, admin.FullName, portalUrl);
            await email.SendAsync(admin.Email, s, b);
        }

        return VendorRequestMapper.ToDetailDto(entity);
    }
}
