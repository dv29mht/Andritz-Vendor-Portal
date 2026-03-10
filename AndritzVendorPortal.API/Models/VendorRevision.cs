namespace AndritzVendorPortal.API.Models;

/// <summary>
/// Stores a field-level snapshot of changes made when a Buyer resubmits
/// a Rejected request. One row per resubmission.
/// Matches the frontend revisionHistory shape exactly (§5 Revision Management).
/// </summary>
public class VendorRevision
{
    public int Id { get; set; }

    public int            VendorRequestId { get; set; }
    public VendorRequest? VendorRequest   { get; set; }

    public int      RevisionNo      { get; set; }
    public string   ChangedByUserId { get; set; } = string.Empty;
    public string   ChangedByName   { get; set; } = string.Empty;
    public DateTime ChangedAt       { get; set; } = DateTime.UtcNow;

    /// <summary>The rejection comment that prompted this resubmission.</summary>
    public string? RejectionComment { get; set; }

    /// <summary>
    /// JSON-serialized List&lt;FieldChangeRecord&gt; (camelCase keys).
    /// e.g. [{"field":"vendorName","fieldLabel":"Vendor Name","oldValue":"...","newValue":"..."}]
    /// </summary>
    public string ChangesJson { get; set; } = "[]";
}

/// <param name="Field">camelCase field key matching the frontend, e.g. "vendorName"</param>
public record FieldChangeRecord(
    string Field,
    string FieldLabel,
    string OldValue,
    string NewValue);
