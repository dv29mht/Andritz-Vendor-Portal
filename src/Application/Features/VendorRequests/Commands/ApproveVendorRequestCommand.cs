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
    IConfiguration config,
    IDateTimeProvider clock) : IRequestHandler<ApproveVendorRequestCommand, VendorRequestDetailDto>
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
        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);

        if (entity.Status == VendorRequestStatus.PendingFinalApproval)
        {
            // Notify FinalApprover
            var finalStep = entity.ApprovalSteps.FirstOrDefault(s => s.IsFinalApproval);
            if (finalStep is not null)
            {
                var finalUser = await identity.FindByIdAsync(finalStep.ApproverUserId);
                if (finalUser is not null)
                {
                    var (s, b) = EmailTemplates.ReadyForFinalApproval(summary, portalUrl);
                    await email.SendAsync(finalUser.Email, s, b);
                }
            }

            // Notify buyer + acting approver
            var (saSubject, saBody) = EmailTemplates.StepApproved(summary, approvedBy, null, portalUrl);
            if (buyer is not null) await email.SendAsync(buyer.Email, saSubject, saBody);
            if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
                await email.SendAsync(admin.Email, saSubject, saBody);
        }
        else
        {
            var nextStep = entity.ApprovalSteps
                .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Pending)
                .OrderBy(s => s.StepOrder)
                .FirstOrDefault();

            var (subj, body) = EmailTemplates.StepApproved(summary, approvedBy, nextStep?.ApproverName, portalUrl);

            var recipients = new HashSet<string>();
            if (buyer is not null) recipients.Add(buyer.Email);
            if (admin is not null && !admin.IsArchived) recipients.Add(admin.Email);
            if (nextStep is not null)
            {
                var nextUser = await identity.FindByIdAsync(nextStep.ApproverUserId);
                if (nextUser is not null) recipients.Add(nextUser.Email);
            }
            foreach (var r in recipients) await email.SendAsync(r, subj, body);
        }
    }
}
