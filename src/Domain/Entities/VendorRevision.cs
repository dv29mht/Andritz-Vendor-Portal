using AndritzVendorPortal.Domain.Enums;

namespace AndritzVendorPortal.Domain.Entities;

public class VendorRevision
{
    public int Id { get; set; }

    public int VendorRequestId { get; set; }
    public VendorRequest? VendorRequest { get; set; }

    public int RevisionNo { get; set; }
    public string ChangedByUserId { get; set; } = string.Empty;
    public string ChangedByName { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    public RevisionType RevisionType { get; set; } = RevisionType.Resubmit;

    public string? RejectionComment { get; set; }

    /// <summary>JSON-serialized List&lt;FieldChangeRecord&gt; (camelCase keys).</summary>
    public string ChangesJson { get; set; } = "[]";
}

public record FieldChangeRecord(
    string Field,
    string FieldLabel,
    string OldValue,
    string NewValue);
