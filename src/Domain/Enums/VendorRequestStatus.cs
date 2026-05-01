namespace AndritzVendorPortal.Domain.Enums;

public enum VendorRequestStatus
{
    Draft = 0,
    PendingApproval = 1,
    Rejected = 3,
    PendingFinalApproval = 4,
    Completed = 5
}

public enum ApprovalDecision
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public enum RevisionType
{
    Resubmit = 0,
    CompletedReEdit = 1,
    AdminEdit = 2
}
