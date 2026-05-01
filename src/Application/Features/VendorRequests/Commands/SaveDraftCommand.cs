using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Enums;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record SaveDraftCommand(
    int Id,
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

public class SaveDraftCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IDateTimeProvider clock) : IRequestHandler<SaveDraftCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(SaveDraftCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        var userId = currentUser.RequireUserId();
        if (entity.CreatedByUserId != userId)
            throw new ForbiddenException();
        if (entity.Status != VendorRequestStatus.Draft)
            throw new BadRequestException("Only Draft requests can be updated via this endpoint.");

        // Patch-style update: null = leave unchanged
        if (request.VendorName is not null) entity.VendorName = request.VendorName;
        if (request.ContactPerson is not null) { entity.ContactPerson = request.ContactPerson; entity.ContactInformation = request.ContactPerson; }
        if (request.Telephone is not null) entity.Telephone = request.Telephone;
        if (request.GstNumber is not null) entity.GstNumber = request.GstNumber;
        if (request.PanCard is not null) entity.PanCard = request.PanCard;
        if (request.AddressDetails is not null) entity.AddressDetails = request.AddressDetails;
        if (request.City is not null) entity.City = request.City;
        if (request.Locality is not null) entity.Locality = request.Locality;
        if (request.MaterialGroup is not null) entity.MaterialGroup = request.MaterialGroup;
        if (request.PostalCode is not null) entity.PostalCode = request.PostalCode;
        if (request.State is not null) entity.State = request.State;
        if (request.Country is not null) entity.Country = request.Country;
        if (request.Currency is not null) entity.Currency = request.Currency;
        if (request.PaymentTerms is not null) entity.PaymentTerms = request.PaymentTerms;
        if (request.Incoterms is not null) entity.Incoterms = request.Incoterms;
        if (request.Reason is not null) entity.Reason = request.Reason;
        if (request.YearlyPvo is not null) entity.YearlyPvo = request.YearlyPvo;
        if (request.IsOneTimeVendor is not null) entity.IsOneTimeVendor = request.IsOneTimeVendor.Value;
        if (request.ProposedBy is not null) entity.ProposedBy = request.ProposedBy;
        entity.UpdatedAt = clock.UtcNow;

        if (request.ApproverUserIds is { Count: > 0 })
        {
            var ids = request.ApproverUserIds.Distinct().ToList();
            await ApprovalChainBuilder.ValidateApproversAsync(ids, identity, ct);

            // Remove existing intermediate steps and rebuild
            var existingIntermediate = entity.ApprovalSteps.Where(s => !s.IsFinalApproval).ToList();
            foreach (var s in existingIntermediate)
                db.ApprovalSteps.Remove(s);

            int stepOrder = 1;
            foreach (var aid in ids)
            {
                var u = await identity.FindByIdAsync(aid);
                if (u is null) continue;
                entity.ApprovalSteps.Add(new Domain.Entities.ApprovalStep
                {
                    ApproverUserId = aid,
                    ApproverName = u.FullName,
                    StepOrder = stepOrder++,
                    IsFinalApproval = false
                });
            }

            // Final approver step's order moves to last
            var finalStep = entity.ApprovalSteps.FirstOrDefault(s => s.IsFinalApproval);
            if (finalStep is not null)
                finalStep.StepOrder = stepOrder;
        }

        await db.SaveChangesAsync(ct);
        return VendorRequestMapper.ToDetailDto(entity);
    }
}
