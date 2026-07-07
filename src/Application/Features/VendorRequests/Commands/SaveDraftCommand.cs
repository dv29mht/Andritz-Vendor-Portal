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
    string? Email,
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
    string? PurchasingOrganization,
    string? MsmeCategory,
    string? BankName,
    string? BranchName,
    string? BankAccountNumber,
    string? IfscCode,
    string? BankDocument1,
    string? BankDocument2,
    string? GstDocument,
    string? PanDocument,
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

        // The Save-Draft screen always sends the full form, so overwrite every scalar
        // field outright. The previous patch behaviour (null = leave unchanged) meant a
        // buyer who blanked a field on a saved draft lost the edit: an emptied value is
        // sent as null, the handler skipped it, and the old value reappeared on reload.
        entity.VendorName = request.VendorName ?? string.Empty;
        entity.ContactPerson = request.ContactPerson ?? string.Empty;
        entity.ContactInformation = request.ContactPerson ?? string.Empty;
        entity.Telephone = request.Telephone ?? string.Empty;
        entity.Email = request.Email ?? string.Empty;
        entity.GstNumber = request.GstNumber ?? string.Empty;
        entity.PanCard = request.PanCard ?? string.Empty;
        entity.AddressDetails = request.AddressDetails ?? string.Empty;
        entity.City = request.City ?? string.Empty;
        entity.Locality = request.Locality ?? string.Empty;
        entity.MaterialGroup = request.MaterialGroup ?? string.Empty;
        entity.PostalCode = request.PostalCode ?? string.Empty;
        entity.State = request.State ?? string.Empty;
        entity.Country = request.Country ?? string.Empty;
        entity.Currency = request.Currency ?? string.Empty;
        entity.PaymentTerms = request.PaymentTerms ?? string.Empty;
        entity.Incoterms = request.Incoterms ?? string.Empty;
        entity.Reason = request.Reason ?? string.Empty;
        entity.YearlyPvo = request.YearlyPvo ?? string.Empty;
        entity.IsOneTimeVendor = request.IsOneTimeVendor ?? false;
        entity.ProposedBy = request.ProposedBy ?? string.Empty;
        entity.PurchasingOrganization = request.PurchasingOrganization ?? string.Empty;
        entity.MsmeCategory = request.MsmeCategory ?? string.Empty;
        entity.BankName = request.BankName ?? string.Empty;
        entity.BranchName = request.BranchName ?? string.Empty;
        entity.BankAccountNumber = request.BankAccountNumber ?? string.Empty;
        entity.IfscCode = request.IfscCode ?? string.Empty;
        // Documents keep patch semantics (null = keep what's already stored): the edit
        // screen falls back to a document-less copy of the request when the detail
        // fetch fails, so a null blob must not wipe a previously-uploaded document.
        if (request.BankDocument1 is not null) entity.BankDocument1 = request.BankDocument1;
        if (request.BankDocument2 is not null) entity.BankDocument2 = request.BankDocument2;
        if (request.GstDocument is not null) entity.GstDocument = request.GstDocument;
        if (request.PanDocument is not null) entity.PanDocument = request.PanDocument;
        entity.UpdatedAt = clock.UtcNow;

        if (request.ApproverUserIds is { Count: > 0 })
        {
            var ids = request.ApproverUserIds.Distinct().ToList();
            await ApprovalChainBuilder.ValidateApproversAsync(ids, identity, ct);

            // Remove existing intermediate steps and rebuild. Remove from the loaded
            // nav collection too — db.ApprovalSteps.Remove alone leaves them attached
            // to entity.ApprovalSteps, so the returned DTO (and any later read before
            // reload) would surface the stale steps with the wrong StepOrder.
            var existingIntermediate = entity.ApprovalSteps.Where(s => !s.IsFinalApproval).ToList();
            foreach (var s in existingIntermediate)
            {
                entity.ApprovalSteps.Remove(s);
                db.ApprovalSteps.Remove(s);
            }

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
