using AndritzVendorPortal.Application.Features.VendorRequests.Commands;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// CreateDraftCommand shipped with no validator, so an oversized value reached SQL and came back as
/// "String or binary data would be truncated" → HTTP 500 (10 occurrences on 18 Jun). The narrow
/// columns are already at their limit in production — GstNumber is nvarchar(15) with a max observed
/// length of exactly 15 — so a single trailing space on a pasted value overflows them.
/// </summary>
public class DraftValidatorTests
{
    private const string ValidGst = "22AAAAA0000A1Z5";   // exactly 15 characters

    private static CreateDraftCommand Draft(string? gst = null, string? pan = null, string? postalCode = null) =>
        new(VendorName: "Acme Metals", ContactPerson: "R. Kumar", Telephone: null, Email: null,
            GstNumber: gst, PanCard: pan, AddressDetails: null, City: null, Locality: null,
            MaterialGroup: null, PostalCode: postalCode, State: null, Country: null, Currency: null,
            PaymentTerms: null, Incoterms: null, Reason: null, YearlyPvo: null, IsOneTimeVendor: null,
            ProposedBy: null, PurchasingOrganization: null, MsmeCategory: null, BankName: null,
            BranchName: null, BankAccountNumber: null, IfscCode: null, BankDocument1: null,
            BankDocument2: null, GstDocument: null, PanDocument: null, ApproverUserIds: null);

    [Fact]
    public void A_draft_with_no_fields_filled_in_is_valid()
    {
        // Drafts stay permissive: the caps are about what SQL can store, not about completeness.
        var result = new CreateDraftCommandValidator().Validate(Draft());
        Assert.True(result.IsValid);
    }

    [Fact]
    public void A_gst_number_at_exactly_the_column_width_is_accepted()
    {
        var result = new CreateDraftCommandValidator().Validate(Draft(gst: ValidGst));
        Assert.True(result.IsValid);
    }

    [Fact]
    public void A_gst_number_with_a_trailing_space_is_a_validation_error_not_a_truncation_500()
    {
        // 16 characters — one over nvarchar(15). This is the exact production shape.
        var result = new CreateDraftCommandValidator().Validate(Draft(gst: ValidGst + " "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateDraftCommand.GstNumber));
    }

    [Fact]
    public void An_oversized_postal_code_is_rejected()
    {
        var result = new CreateDraftCommandValidator().Validate(Draft(postalCode: new string('9', 11)));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateDraftCommand.PostalCode));
    }

    [Fact]
    public void An_oversized_pan_card_is_rejected()
    {
        var result = new CreateDraftCommandValidator().Validate(Draft(pan: "ABCDE1234F "));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(CreateDraftCommand.PanCard));
    }

    [Fact]
    public void A_malformed_gst_number_is_rejected_but_NA_is_allowed_for_foreign_vendors()
    {
        Assert.False(new CreateDraftCommandValidator().Validate(Draft(gst: "NOT-A-GST")).IsValid);
        Assert.True(new CreateDraftCommandValidator().Validate(Draft(gst: "N/A")).IsValid);
    }

    [Fact]
    public void Save_draft_enforces_the_same_caps_as_create_draft()
    {
        // SaveDraftCommand had no validator either, and writes the very same columns.
        var command = new SaveDraftCommand(
            Id: 1, VendorName: "Acme Metals", ContactPerson: null, Telephone: null, Email: null,
            GstNumber: ValidGst + " ", PanCard: null, AddressDetails: null, City: null, Locality: null,
            MaterialGroup: null, PostalCode: null, State: null, Country: null, Currency: null,
            PaymentTerms: null, Incoterms: null, Reason: null, YearlyPvo: null, IsOneTimeVendor: null,
            ProposedBy: null, PurchasingOrganization: null, MsmeCategory: null, BankName: null,
            BranchName: null, BankAccountNumber: null, IfscCode: null, BankDocument1: null,
            BankDocument2: null, GstDocument: null, PanDocument: null, ApproverUserIds: null);

        var result = new SaveDraftCommandValidator().Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(SaveDraftCommand.GstNumber));
    }
}
