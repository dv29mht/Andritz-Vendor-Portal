using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record BuyerUpdateCompletedCommand(
    int Id,
    string VendorName,
    string ContactPerson,
    string? Telephone,
    string GstNumber,
    string PanCard,
    string AddressDetails,
    string City,
    string Locality,
    string? MaterialGroup,
    string? PostalCode,
    string? State,
    string? Country,
    string? Currency,
    string? PaymentTerms,
    string? Incoterms,
    string? Reason,
    string? YearlyPvo,
    bool? IsOneTimeVendor,
    string? ProposedBy,
    List<string>? ApproverUserIds) : IRequest<VendorRequestDetailDto>;

public class BuyerUpdateCompletedCommandValidator : AbstractValidator<BuyerUpdateCompletedCommand>
{
    public BuyerUpdateCompletedCommandValidator()
    {
        RuleFor(x => x.VendorName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactPerson).NotEmpty().MaximumLength(100);
        RuleFor(x => x.GstNumber).NotEmpty().Matches(ValidationPatterns.Gst).WithMessage(ValidationPatterns.GstError);
        RuleFor(x => x.PanCard).NotEmpty().Matches(ValidationPatterns.Pan).WithMessage(ValidationPatterns.PanError);
        RuleFor(x => x.AddressDetails).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Locality).NotEmpty().MaximumLength(100);
    }
}

public class BuyerUpdateCompletedCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IEmailService email,
    IConfiguration config,
    IDateTimeProvider clock) : IRequestHandler<BuyerUpdateCompletedCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(BuyerUpdateCompletedCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        if (entity.CreatedByUserId != userId) throw new ForbiddenException();
        if (entity.Status != VendorRequestStatus.Completed)
            throw new BadRequestException("Only Completed requests can be updated via this endpoint.");

        var intermediate = entity.ApprovalSteps.Where(s => !s.IsFinalApproval).OrderBy(s => s.StepOrder).ToList();
        var staleNames = new List<string>();
        foreach (var step in intermediate)
            if (await identity.FindByIdAsync(step.ApproverUserId) is null)
                staleNames.Add(step.ApproverName);

        if (staleNames.Count > 0 && (request.ApproverUserIds is null || request.ApproverUserIds.Count == 0))
            throw new ConflictException(
                "One or more approvers in the original chain no longer exist. Please provide a new approval chain.");

        if (request.ApproverUserIds is { Count: > 0 })
        {
            var newIds = request.ApproverUserIds.Distinct().ToList();
            await ApprovalChainBuilder.ValidateApproversAsync(newIds, identity, ct);

            var finalStep = entity.ApprovalSteps.First(s => s.IsFinalApproval);
            foreach (var s in intermediate) db.ApprovalSteps.Remove(s);

            int stepOrder = 1;
            foreach (var aid in newIds)
            {
                var u = await identity.FindByIdAsync(aid);
                entity.ApprovalSteps.Add(new ApprovalStep
                {
                    ApproverUserId = aid,
                    ApproverName = u!.FullName,
                    StepOrder = stepOrder++,
                    IsFinalApproval = false
                });
            }
            finalStep.StepOrder = stepOrder;
            finalStep.Decision = ApprovalDecision.Pending;
            finalStep.Comment = null;
            finalStep.DecidedAt = null;
        }
        else
        {
            foreach (var s in entity.ApprovalSteps)
            {
                s.Decision = ApprovalDecision.Pending;
                s.Comment = null;
                s.DecidedAt = null;
            }
        }

        var input = new VendorFieldsInput(
            request.VendorName, request.ContactPerson, request.Telephone,
            request.GstNumber, request.PanCard, request.AddressDetails,
            request.City, request.Locality, request.MaterialGroup, request.PostalCode,
            request.State, request.Country, request.Currency, request.PaymentTerms,
            request.Incoterms, request.Reason, request.YearlyPvo,
            request.IsOneTimeVendor, request.ProposedBy);

        var changes = TrackedFields.ComputeDiff(entity, input);
        var newRevNo = entity.RevisionNo + 1;
        var changedBy = await identity.FindByIdAsync(userId);

        var revision = new VendorRevision
        {
            VendorRequestId = entity.Id,
            RevisionNo = newRevNo,
            ChangedByUserId = userId,
            ChangedByName = changedBy?.FullName ?? string.Empty,
            ChangedAt = clock.UtcNow,
            RevisionType = RevisionType.CompletedReEdit,
            ChangesJson = VendorRequestMapper.SerializeChanges(changes)
        };
        db.VendorRevisions.Add(revision);

        TrackedFields.Apply(entity, input);
        entity.RevisionNo = newRevNo;
        var hasIntermediate = entity.ApprovalSteps.Any(s => !s.IsFinalApproval);
        entity.Status = hasIntermediate ? VendorRequestStatus.PendingApproval : VendorRequestStatus.PendingFinalApproval;
        entity.UpdatedAt = clock.UtcNow;

        await db.SaveChangesAsync(ct);

        await SendNotificationsAsync(entity, ct);
        entity.RevisionHistory.Add(revision);
        return VendorRequestMapper.ToDetailDto(entity);
    }

    private async Task SendNotificationsAsync(VendorRequest entity, CancellationToken ct)
    {
        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var summary = VendorRequestMapper.ToSummary(entity);
        var buyer = await identity.FindByIdAsync(entity.CreatedByUserId);
        var admin = await identity.FindByEmailAsync(SystemAccounts.AdminEmail);

        if (buyer is not null)
        {
            var (s, b) = EmailTemplates.CompletedReEditConfirmed(summary, portalUrl);
            await email.SendAsync(buyer.Email, s, b);
        }

        var hasIntermediate = entity.ApprovalSteps.Any(s => !s.IsFinalApproval);
        var firstStep = entity.ApprovalSteps
            .Where(s => hasIntermediate ? !s.IsFinalApproval : s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        if (firstStep is not null)
        {
            var approver = await identity.FindByIdAsync(firstStep.ApproverUserId);
            if (approver is not null)
            {
                var (s, b) = EmailTemplates.CompletedReEditSubmitted(summary, firstStep.ApproverName, portalUrl);
                await email.SendAsync(approver.Email, s, b);
            }
        }

        if (admin is not null && !admin.IsArchived && admin.Email != buyer?.Email)
        {
            var (s, b) = EmailTemplates.CompletedReEditSubmitted(summary, admin.FullName, portalUrl);
            await email.SendAsync(admin.Email, s, b);
        }
    }
}
