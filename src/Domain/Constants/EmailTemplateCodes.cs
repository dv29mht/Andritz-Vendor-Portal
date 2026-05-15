namespace AndritzVendorPortal.Domain.Constants;

/// <summary>
/// Stable identifiers for editable email templates stored in the database.
/// Handlers reference these codes; admins edit Subject / Body in the admin panel.
/// </summary>
public static class EmailTemplateCodes
{
    public const string BuyerRequestSubmitted        = "BuyerRequestSubmitted";
    public const string ApproverApprovalRequest      = "ApproverApprovalRequest";
    public const string BuyerRejected                = "BuyerRejected";
    public const string FinalApproverPending         = "FinalApproverPending";
    public const string BuyerVendorApproved          = "BuyerVendorApproved";
    public const string AdminNewVendorRequest        = "AdminNewVendorRequest";
    public const string AdminVendorApproved          = "AdminVendorApproved";
    public const string ApproverResubmitted          = "ApproverResubmitted";
    public const string BuyerResubmissionConfirmation = "BuyerResubmissionConfirmation";
    public const string BuyerInvitation              = "BuyerInvitation";
    public const string ApproverInvitation           = "ApproverInvitation";
}
