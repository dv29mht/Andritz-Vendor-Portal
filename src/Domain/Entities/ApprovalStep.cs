using AndritzVendorPortal.Domain.Enums;

namespace AndritzVendorPortal.Domain.Entities;

public class ApprovalStep
{
    public int Id { get; set; }
    public int VendorRequestId { get; set; }
    public VendorRequest? VendorRequest { get; set; }

    public string ApproverUserId { get; set; } = string.Empty;
    public string ApproverName { get; set; } = string.Empty;
    public int StepOrder { get; set; }

    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Pending;
    public string? Comment { get; set; }
    public DateTime? DecidedAt { get; set; }
    public bool IsFinalApproval { get; set; }

    public bool IsDeletedApprover { get; set; } = false;
    public string? DeletedApproverNote { get; set; }
}
