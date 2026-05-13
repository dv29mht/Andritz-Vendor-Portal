using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Commands;

public record CreateVendorRequestCommand(
    string VendorName,
    string ContactPerson,
    string? Telephone,
    string GstNumber,
    string? PanCard,
    string AddressDetails,
    string City,
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

public class CreateVendorRequestCommandValidator : AbstractValidator<CreateVendorRequestCommand>
{
    public CreateVendorRequestCommandValidator()
    {
        RuleFor(x => x.VendorName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactPerson).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Telephone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.GstNumber).NotEmpty().Matches(ValidationPatterns.Gst).WithMessage(ValidationPatterns.GstError);
        RuleFor(x => x.PanCard)
            .Matches(ValidationPatterns.Pan).WithMessage(ValidationPatterns.PanError)
            .When(x => !string.IsNullOrWhiteSpace(x.PanCard));
        RuleFor(x => x.AddressDetails).NotEmpty().MaximumLength(500);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(500);
        RuleFor(x => x.PostalCode).NotEmpty().MaximumLength(10);
        RuleFor(x => x.Country).NotEmpty();
        RuleFor(x => x.State).NotEmpty();
        RuleFor(x => x.Currency).NotEmpty();
        RuleFor(x => x.Incoterms).NotEmpty();
        RuleFor(x => x.PurchasingOrganization)
            .NotEmpty()
            .Must(v => v is "900D" or "900I" or "P20D" or "T20I")
            .WithMessage("Purchasing Organization must be one of: 900D, 900I, P20D, T20I.");
        RuleFor(x => x.MsmeCategory)
            .Must(v => v is "Micro" or "Small" or "Medium")
            .When(x => !string.IsNullOrWhiteSpace(x.MsmeCategory))
            .WithMessage("MSME Category, if provided, must be Micro, Small, or Medium.");
        RuleFor(x => x.BankName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.BranchName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.BankAccountNumber).NotEmpty().MaximumLength(50);
        RuleFor(x => x.IfscCode).NotEmpty().MaximumLength(20);
        RuleFor(x => x.GstDocument).NotEmpty().WithMessage("GST document upload is required.");
        RuleFor(x => x.BankDocument1).NotEmpty().WithMessage("Bank document upload is required.");
    }
}

public class CreateVendorRequestCommandHandler(
    IApplicationDbContext db,
    IVendorRequestRepository repo,
    IIdentityService identity,
    ICurrentUserService currentUser,
    IDateTimeProvider clock) : IRequestHandler<CreateVendorRequestCommand, VendorRequestDetailDto>
{
    public async Task<VendorRequestDetailDto> Handle(CreateVendorRequestCommand request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var approverIds = (request.ApproverUserIds ?? []).Distinct().ToList();

        // Validate approver users exist + have Approver role
        await ApprovalChainBuilder.ValidateApproversAsync(approverIds, identity, ct);

        // GST/PAN uniqueness — existing non-archived non-rejected requests
        if (!string.IsNullOrWhiteSpace(request.GstNumber)
            && await repo.GstNumberExistsAsync(request.GstNumber, null, ct))
            throw new ConflictException("A request with this GST number already exists.");

        if (!string.IsNullOrWhiteSpace(request.PanCard)
            && await repo.PanCardExistsAsync(request.PanCard, null, ct))
            throw new ConflictException("A request with this PAN number already exists.");

        var creator = await identity.FindByIdAsync(userId);
        var entity = new VendorRequest
        {
            CreatedByUserId = userId,
            CreatedByName = creator?.FullName ?? string.Empty,
            Status = VendorRequestStatus.Draft,
            CreatedAt = clock.UtcNow,
            UpdatedAt = clock.UtcNow
        };

        TrackedFields.Apply(entity, new VendorFieldsInput(
            request.VendorName, request.ContactPerson, request.Telephone,
            request.GstNumber, request.PanCard, request.AddressDetails,
            request.City, request.Locality, request.MaterialGroup, request.PostalCode,
            request.State, request.Country, request.Currency, request.PaymentTerms,
            request.Incoterms, request.Reason, request.YearlyPvo,
            request.IsOneTimeVendor, request.ProposedBy,
            request.PurchasingOrganization, request.MsmeCategory,
            request.BankName, request.BranchName, request.BankAccountNumber, request.IfscCode,
            request.BankDocument1, request.BankDocument2, request.GstDocument, request.PanDocument));

        await ApprovalChainBuilder.BuildAsync(entity, approverIds, identity, ct);

        db.VendorRequests.Add(entity);
        await db.SaveChangesAsync(ct);
        return VendorRequestMapper.ToDetailDto(entity);
    }
}
