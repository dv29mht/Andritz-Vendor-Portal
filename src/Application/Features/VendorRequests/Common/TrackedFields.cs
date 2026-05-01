using AndritzVendorPortal.Domain.Entities;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

/// <summary>
/// Field-level diff tracker. Mirrors the frontend's TRACKED_FIELDS list.
/// Used to compute revision diffs whenever a vendor request is resubmitted or admin-edited.
/// </summary>
public static class TrackedFields
{
    public record TrackedField(
        string CamelKey,
        string Label,
        Func<VendorRequest, string> GetFromRequest,
        Func<VendorFieldsInput, string> GetFromInput);

    public static readonly TrackedField[] All =
    [
        new("vendorName",     "Vendor Name",     r => r.VendorName,     d => d.VendorName),
        new("materialGroup",  "Material Group",  r => r.MaterialGroup,  d => d.MaterialGroup ?? string.Empty),
        new("reason",         "Reason",          r => r.Reason,         d => d.Reason ?? string.Empty),
        new("contactPerson",  "Contact Person",  r => r.ContactPerson,  d => d.ContactPerson ?? string.Empty),
        new("telephone",      "Telephone",       r => r.Telephone,      d => d.Telephone ?? string.Empty),
        new("gstNumber",      "GST Number",      r => r.GstNumber,      d => d.GstNumber),
        new("panCard",        "PAN Card",        r => r.PanCard,        d => d.PanCard),
        new("addressDetails", "Address Details", r => r.AddressDetails, d => d.AddressDetails),
        new("postalCode",     "Postal Code",     r => r.PostalCode,     d => d.PostalCode ?? string.Empty),
        new("city",           "City",            r => r.City,           d => d.City),
        new("locality",       "Locality",        r => r.Locality,       d => d.Locality),
        new("state",          "State",           r => r.State,          d => d.State ?? string.Empty),
        new("country",        "Country",         r => r.Country,        d => d.Country ?? string.Empty),
        new("currency",       "Currency",        r => r.Currency,       d => d.Currency ?? string.Empty),
        new("paymentTerms",   "Payment Terms",   r => r.PaymentTerms,   d => d.PaymentTerms ?? string.Empty),
        new("incoterms",      "Incoterms",       r => r.Incoterms,      d => d.Incoterms ?? string.Empty),
        new("yearlyPvo",      "Yearly PVO",      r => r.YearlyPvo,      d => d.YearlyPvo ?? string.Empty),
        new("proposedBy",     "Proposed By",     r => r.ProposedBy,     d => d.ProposedBy ?? string.Empty)
    ];

    public static List<FieldChangeRecord> ComputeDiff(VendorRequest before, VendorFieldsInput after) =>
        All
            .Where(f => f.GetFromRequest(before) != f.GetFromInput(after))
            .Select(f => new FieldChangeRecord(
                f.CamelKey, f.Label, f.GetFromRequest(before), f.GetFromInput(after)))
            .ToList();

    /// <summary>
    /// Applies all editable vendor fields from the input onto the entity.
    /// Single source of truth — used by Create, Resubmit, AdminEdit, and BuyerUpdateCompleted.
    /// </summary>
    public static void Apply(VendorRequest r, VendorFieldsInput d)
    {
        r.VendorName = d.VendorName;
        r.ContactPerson = d.ContactPerson ?? string.Empty;
        r.ContactInformation = d.ContactPerson ?? string.Empty;
        r.Telephone = d.Telephone ?? string.Empty;
        r.GstNumber = d.GstNumber;
        r.PanCard = d.PanCard;
        r.AddressDetails = d.AddressDetails;
        r.City = d.City;
        r.Locality = d.Locality;
        r.MaterialGroup = d.MaterialGroup ?? string.Empty;
        r.PostalCode = d.PostalCode ?? string.Empty;
        r.State = d.State ?? string.Empty;
        r.Country = d.Country ?? "India";
        r.Currency = d.Currency ?? "INR";
        r.PaymentTerms = d.PaymentTerms ?? string.Empty;
        r.Incoterms = d.Incoterms ?? string.Empty;
        r.Reason = d.Reason ?? string.Empty;
        r.YearlyPvo = d.YearlyPvo ?? string.Empty;
        r.IsOneTimeVendor = d.IsOneTimeVendor ?? false;
        r.ProposedBy = d.ProposedBy ?? string.Empty;
    }
}

/// <summary>Common shape used by Create / Resubmit / AdminEdit / BuyerUpdate to apply field updates.</summary>
public record VendorFieldsInput(
    string VendorName,
    string? ContactPerson,
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
    string? ProposedBy);
