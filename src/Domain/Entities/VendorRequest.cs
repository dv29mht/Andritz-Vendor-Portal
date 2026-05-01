using AndritzVendorPortal.Domain.Common;
using AndritzVendorPortal.Domain.Enums;

namespace AndritzVendorPortal.Domain.Entities;

public class VendorRequest : ISoftDelete, IAuditable
{
    public int Id { get; set; }

    // Vendor Details
    public string VendorName { get; set; } = string.Empty;
    public string ContactInformation { get; set; } = string.Empty;
    public string GstNumber { get; set; } = string.Empty;
    public string PanCard { get; set; } = string.Empty;
    public string AddressDetails { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Locality { get; set; } = string.Empty;

    // Extended Vendor Fields
    public string MaterialGroup { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Country { get; set; } = "India";
    public string Currency { get; set; } = "INR";
    public string PaymentTerms { get; set; } = string.Empty;
    public string Incoterms { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string YearlyPvo { get; set; } = string.Empty;
    public bool IsOneTimeVendor { get; set; } = false;
    public string ProposedBy { get; set; } = string.Empty;

    // Workflow State
    public VendorRequestStatus Status { get; set; } = VendorRequestStatus.Draft;
    public int RevisionNo { get; set; } = 0;
    public string? RejectionComment { get; set; }

    // Vendor Code (Final Approver only)
    public string? VendorCode { get; set; }
    public DateTime? VendorCodeAssignedAt { get; set; }
    public string? VendorCodeAssignedBy { get; set; }

    // Soft delete
    public bool IsArchived { get; set; } = false;
    public DateTime? ArchivedAt { get; set; }

    // Audit
    public string CreatedByUserId { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedBy { get; set; }
    public string? ModifiedBy { get; set; }

    // Relations
    public ICollection<ApprovalStep> ApprovalSteps { get; set; } = new List<ApprovalStep>();
    public ICollection<VendorRevision> RevisionHistory { get; set; } = new List<VendorRevision>();
}
