using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record AdminEditVendorRequestCommand(
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
    string? ProposedBy) : IRequest<VendorRequestDetailDto>;

public class AdminEditVendorRequestCommandValidator : AbstractValidator<AdminEditVendorRequestCommand>
{
    public AdminEditVendorRequestCommandValidator()
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

public class AdminEditVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IDateTimeProvider clock) : IRequestHandler<AdminEditVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(AdminEditVendorRequestCommand request, CancellationToken ct)
    {
        var entity = await repo.GetByIdWithDetailsAsync(request.Id, ct)
            ?? throw new NotFoundException("VendorRequest", request.Id);

        if (entity.Status != VendorRequestStatus.Completed)
            throw new BadRequestException("Only completed (SAP-approved) requests can be edited by Admin.");

        var input = new VendorFieldsInput(
            request.VendorName, request.ContactPerson, request.Telephone,
            request.GstNumber, request.PanCard, request.AddressDetails,
            request.City, request.Locality, request.MaterialGroup, request.PostalCode,
            request.State, request.Country, request.Currency, request.PaymentTerms,
            request.Incoterms, request.Reason, request.YearlyPvo,
            request.IsOneTimeVendor, request.ProposedBy);

        var changes = TrackedFields.ComputeDiff(entity, input);

        if (changes.Count > 0)
        {
            var newRevNo = entity.RevisionNo + 1;
            var userId = currentUser.RequireUserId();
            var admin = await identity.FindByIdAsync(userId);

            var revision = new VendorRevision
            {
                VendorRequestId = entity.Id,
                RevisionNo = newRevNo,
                ChangedByUserId = userId,
                ChangedByName = admin?.FullName ?? string.Empty,
                ChangedAt = clock.UtcNow,
                RevisionType = RevisionType.AdminEdit,
                ChangesJson = VendorRequestMapper.SerializeChanges(changes)
            };
            db.VendorRevisions.Add(revision);
            entity.RevisionNo = newRevNo;
        }

        TrackedFields.Apply(entity, input);
        entity.IsOneTimeVendor = request.IsOneTimeVendor ?? entity.IsOneTimeVendor;
        entity.UpdatedAt = clock.UtcNow;

        await db.SaveChangesAsync(ct);
        return VendorRequestMapper.ToDetailDto(entity);
    }
}
