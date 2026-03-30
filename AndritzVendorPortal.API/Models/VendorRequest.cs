namespace AndritzVendorPortal.API.Models;

public enum VendorRequestStatus
{
    Draft                = 0,
    PendingApproval      = 1,
    Rejected             = 3,
    PendingFinalApproval = 4,  // Forwarded to Pardeep Sharma
    Completed            = 5   // Vendor code assigned; workflow done
}

public class VendorRequest
{
    public int Id { get; set; }

    // -- Vendor Details --
    public string VendorName         { get; set; } = string.Empty;
    public string ContactInformation { get; set; } = string.Empty;
    public string GstNumber          { get; set; } = string.Empty;
    public string PanCard            { get; set; } = string.Empty;
    public string AddressDetails     { get; set; } = string.Empty;
    public string City               { get; set; } = string.Empty;
    public string Locality           { get; set; } = string.Empty;

    // -- Extended Vendor Fields --
    public string MaterialGroup  { get; set; } = string.Empty;
    public string PostalCode     { get; set; } = string.Empty;
    public string State          { get; set; } = string.Empty;
    public string Country        { get; set; } = "India";
    public string Currency       { get; set; } = "INR";
    public string PaymentTerms   { get; set; } = string.Empty;
    public string Incoterms      { get; set; } = string.Empty;
    public string ContactPerson  { get; set; } = string.Empty;
    public string Telephone      { get; set; } = string.Empty;
    public string Reason         { get; set; } = string.Empty;
    public string YearlyPvo      { get; set; } = string.Empty;
    public bool   IsOneTimeVendor { get; set; } = false;
    public string ProposedBy     { get; set; } = string.Empty;

    // -- Workflow State --
    public VendorRequestStatus Status          { get; set; } = VendorRequestStatus.Draft;
    public int                 RevisionNo      { get; set; } = 0;
    public string?             RejectionComment { get; set; }

    // -- Vendor Code (set exclusively by the Final Approver) --
    public string?   VendorCode           { get; set; }
    public DateTime? VendorCodeAssignedAt { get; set; }
    public string?   VendorCodeAssignedBy { get; set; }

    // -- Soft-delete --
    public bool      IsArchived { get; set; } = false;
    public DateTime? ArchivedAt { get; set; }

    // -- Audit --
    public string           CreatedByUserId { get; set; } = string.Empty;
    public string           CreatedByName   { get; set; } = string.Empty;  // denormalized
    public ApplicationUser? CreatedBy       { get; set; }
    public DateTime         CreatedAt       { get; set; } = DateTime.UtcNow;
    public DateTime         UpdatedAt       { get; set; } = DateTime.UtcNow;

    // -- Relations --
    public ICollection<ApprovalStep>  ApprovalSteps   { get; set; } = [];
    public ICollection<VendorRevision> RevisionHistory { get; set; } = [];
}

public enum ApprovalDecision { Pending, Approved, Rejected }

public class ApprovalStep
{
    public int    Id              { get; set; }
    public int    VendorRequestId { get; set; }
    public VendorRequest? VendorRequest { get; set; }

    public string ApproverUserId { get; set; } = string.Empty;
    public string ApproverName   { get; set; } = string.Empty;  // denormalized
    public int    StepOrder      { get; set; }

    public ApprovalDecision Decision        { get; set; } = ApprovalDecision.Pending;
    public string?          Comment         { get; set; }
    public DateTime?        DecidedAt       { get; set; }
    public bool             IsFinalApproval { get; set; }
}
