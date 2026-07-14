using FluentValidation;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

/// <summary>
/// The vendor fields a draft carries. CreateDraftCommand and SaveDraftCommand are records whose
/// positional parameters already have exactly these names, so both satisfy this interface for free
/// and can share one validator.
/// </summary>
public interface IDraftVendorFields
{
    string? VendorName { get; }
    string? ContactPerson { get; }
    string? Telephone { get; }
    string? Email { get; }
    string? GstNumber { get; }
    string? PanCard { get; }
    string? AddressDetails { get; }
    string? City { get; }
    string? Locality { get; }
    string? MaterialGroup { get; }
    string? PostalCode { get; }
    string? State { get; }
    string? Country { get; }
    string? Currency { get; }
    string? PaymentTerms { get; }
    string? Incoterms { get; }
    string? Reason { get; }
    string? YearlyPvo { get; }
    string? ProposedBy { get; }
    string? PurchasingOrganization { get; }
    string? MsmeCategory { get; }
    string? BankName { get; }
    string? BranchName { get; }
    string? BankAccountNumber { get; }
    string? IfscCode { get; }
}

/// <summary>
/// Length caps for the draft commands, mirroring the column widths in VendorRequestConfiguration.
///
/// <para>CreateDraftCommand shipped with no validator at all, so oversized input went straight to
/// SQL and came back as <c>String or binary data would be truncated</c> → HTTP 500 (10 occurrences
/// on 18 Jun). The narrow columns are already at their limit in production data — GstNumber
/// nvarchar(15) with a max observed length of 15, PanCard nvarchar(10) at 10 — so a single trailing
/// space on a pasted value overflows them. These rules turn that into a clean 400 naming the field.
/// SaveDraftCommand had no validator either and writes the same columns, so it gets the same caps.</para>
///
/// <para>Drafts stay permissive about <em>content</em> — every field is optional, and only GST gets
/// a format check, and only when it is filled in. The caps exist so we never hand SQL a value the
/// column cannot hold.</para>
/// </summary>
public abstract class DraftVendorFieldsValidator<T> : AbstractValidator<T> where T : IDraftVendorFields
{
    protected DraftVendorFieldsValidator()
    {
        RuleFor(x => x.VendorName).MaximumLength(200);
        RuleFor(x => x.ContactPerson).MaximumLength(100);
        RuleFor(x => x.Telephone).MaximumLength(30);
        RuleFor(x => x.Email).MaximumLength(200);
        RuleFor(x => x.AddressDetails).MaximumLength(500);
        RuleFor(x => x.City).MaximumLength(100);
        RuleFor(x => x.Locality).MaximumLength(100);
        RuleFor(x => x.MaterialGroup).MaximumLength(200);
        RuleFor(x => x.PostalCode).MaximumLength(10);
        RuleFor(x => x.State).MaximumLength(100);
        RuleFor(x => x.Country).MaximumLength(100);
        RuleFor(x => x.Currency).MaximumLength(10);
        RuleFor(x => x.PaymentTerms).MaximumLength(200);
        RuleFor(x => x.Incoterms).MaximumLength(200);
        RuleFor(x => x.Reason).MaximumLength(1000);
        RuleFor(x => x.YearlyPvo).MaximumLength(100);
        RuleFor(x => x.ProposedBy).MaximumLength(200);
        RuleFor(x => x.PurchasingOrganization).MaximumLength(10);
        RuleFor(x => x.MsmeCategory).MaximumLength(20);
        RuleFor(x => x.BankName).MaximumLength(200);
        RuleFor(x => x.BranchName).MaximumLength(200);
        RuleFor(x => x.BankAccountNumber).MaximumLength(50);
        RuleFor(x => x.IfscCode).MaximumLength(20);

        // No PAN format rule — other countries use other formats, so PAN stays free text (as in
        // the four already-validated commands). It still has to fit in nvarchar(10).
        RuleFor(x => x.PanCard).MaximumLength(10);

        // GST: the cap catches the trailing-space overflow; the format check is the same one
        // CreateVendorRequest / Resubmit / BuyerUpdateCompleted / AdminEdit already apply — a
        // 15-char Indian GST, or "N/A" for import / foreign vendors.
        RuleFor(x => x.GstNumber).MaximumLength(15);
        RuleFor(x => x.GstNumber)
            .Must(ValidationPatterns.IsGstOrNa)
            .WithMessage(ValidationPatterns.GstError);
    }
}
