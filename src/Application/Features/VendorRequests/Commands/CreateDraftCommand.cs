using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

/// <summary>Buyer saves a request as Draft — all fields optional, no validation other than maxlength.</summary>
public record CreateDraftCommand(
    string? VendorName,
    string? ContactPerson,
    string? Telephone,
    string? GstNumber,
    string? PanCard,
    string? AddressDetails,
    string? City,
    string? Locality,
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

public class CreateDraftCommandHandler(
    IApplicationDbContext db,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IDateTimeProvider clock) : IRequestHandler<CreateDraftCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(CreateDraftCommand request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var creator = await identity.FindByIdAsync(userId);

        var entity = new VendorRequest
        {
            CreatedByUserId = userId,
            CreatedByName = creator?.FullName ?? string.Empty,
            Status = VendorRequestStatus.Draft,
            VendorName = request.VendorName ?? string.Empty,
            ContactInformation = request.ContactPerson ?? string.Empty,
            ContactPerson = request.ContactPerson ?? string.Empty,
            Telephone = request.Telephone ?? string.Empty,
            GstNumber = request.GstNumber ?? string.Empty,
            PanCard = request.PanCard ?? string.Empty,
            AddressDetails = request.AddressDetails ?? string.Empty,
            City = request.City ?? string.Empty,
            Locality = request.Locality ?? string.Empty,
            MaterialGroup = request.MaterialGroup ?? string.Empty,
            PostalCode = request.PostalCode ?? string.Empty,
            State = request.State ?? string.Empty,
            Country = request.Country ?? string.Empty,
            Currency = request.Currency ?? string.Empty,
            PaymentTerms = request.PaymentTerms ?? string.Empty,
            Incoterms = request.Incoterms ?? string.Empty,
            Reason = request.Reason ?? string.Empty,
            YearlyPvo = request.YearlyPvo ?? string.Empty,
            IsOneTimeVendor = request.IsOneTimeVendor ?? false,
            ProposedBy = request.ProposedBy ?? string.Empty,
            CreatedAt = clock.UtcNow,
            UpdatedAt = clock.UtcNow
        };

        if (request.ApproverUserIds is { Count: > 0 })
        {
            var stepOrder = 1;
            foreach (var aid in request.ApproverUserIds.Distinct())
            {
                var approver = await identity.FindByIdAsync(aid);
                if (approver is null) continue;
                entity.ApprovalSteps.Add(new ApprovalStep
                {
                    ApproverUserId = aid,
                    ApproverName = approver.FullName,
                    StepOrder = stepOrder++,
                    IsFinalApproval = false
                });
            }
        }

        // Always append final approver
        var finalApprover = await identity.FindByEmailAsync(SystemAccounts.FinalApproverEmail)
            ?? throw new NotFoundException("Final Approver account not found. Contact admin.");
        entity.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId = finalApprover.Id,
            ApproverName = finalApprover.FullName,
            StepOrder = entity.ApprovalSteps.Count + 1,
            IsFinalApproval = true
        });

        db.VendorRequests.Add(entity);
        await db.SaveChangesAsync(ct);
        return VendorRequestMapper.ToDetailDto(entity);
    }
}
