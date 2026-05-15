using AndritzVendorPortal.Domain.Constants;

namespace AndritzVendorPortal.Application.Services;

/// <summary>
/// Seed-time defaults for every editable email template. The default text is
/// preserved alongside the live copy so admins can reset to factory from the
/// admin panel.
/// </summary>
public static class EmailTemplateDefaults
{
    public record Definition(
        string Code,
        string Name,
        string Audience,
        string Subject,
        string BodyText,
        string Placeholders);

    public static IReadOnlyList<Definition> All { get; } =
    [
        new Definition(
            EmailTemplateCodes.BuyerRequestSubmitted,
            "Buyer – Request Submitted Successfully",
            "Buyer",
            "Vendor Registration Request Submitted Successfully",
            """
            Dear [Buyer Name],

            Your Vendor Registration Request has been successfully submitted in the Andritz Vendor Registration Portal.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Submitted On: [Date & Time]

            The request has now been forwarded to the selected approver(s) for review and approval.

            You will receive further notifications regarding the approval status.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Buyer Name],[Request ID],[Vendor Name],[Date & Time]"),

        new Definition(
            EmailTemplateCodes.ApproverApprovalRequest,
            "Approver – Approval Request Notification",
            "Approver",
            "Vendor Registration Request Pending for Your Approval",
            """
            Dear [Approver Name],

            A Vendor Registration Request has been assigned to you for review and approval.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Submitted By: [Buyer Name]
            • Submission Date: [Date & Time]

            Please review the request in the Andritz Vendor Registration Portal and take the necessary action.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Approver Name],[Request ID],[Vendor Name],[Buyer Name],[Date & Time]"),

        new Definition(
            EmailTemplateCodes.BuyerRejected,
            "Buyer – Request Rejected",
            "Buyer",
            "Vendor Registration Request Rejected",
            """
            Dear [Buyer Name],

            Your Vendor Registration Request has been rejected and requires modification before resubmission.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Rejected By: [Approver Name]

            Rejection Comments:
            [Comments]

            Please update the required details and resubmit the request.
            The system will maintain the updated submission under the next revision version.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Buyer Name],[Request ID],[Vendor Name],[Approver Name],[Comments]"),

        new Definition(
            EmailTemplateCodes.FinalApproverPending,
            "Final Approver – Final Approval Pending",
            "Final Approver",
            "Vendor Registration Request Pending for Final Approval",
            """
            Dear [Final Approver Name],

            A Vendor Registration Request is pending for your final approval and vendor code update.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Approved By: [Intermediate Approver Name(s)]

            Please review the request and update the Vendor Code generated from SAP to complete the process.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Final Approver Name],[Request ID],[Vendor Name],[Intermediate Approver Name(s)]"),

        new Definition(
            EmailTemplateCodes.BuyerVendorApproved,
            "Buyer – Vendor Approved",
            "Buyer",
            "Vendor Registration Approved Successfully",
            """
            Dear [Buyer Name],

            Your Vendor Registration Request has been successfully approved.

            Vendor Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Vendor Code: [Vendor Code]

            The vendor registration process has been completed successfully.

            You may now download the approved Vendor Registration PDF document from the portal.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Buyer Name],[Request ID],[Vendor Name],[Vendor Code]"),

        new Definition(
            EmailTemplateCodes.AdminNewVendorRequest,
            "Admin – New Vendor Request Created",
            "Admin",
            "New Vendor Registration Request Created",
            """
            Dear Admin,

            A new Vendor Registration Request has been created in the system.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Created By: [Buyer Name]
            • Submission Date: [Date & Time]

            You can monitor the request status from the Admin Dashboard.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Request ID],[Vendor Name],[Buyer Name],[Date & Time]"),

        new Definition(
            EmailTemplateCodes.AdminVendorApproved,
            "Admin – Vendor Approved Notification",
            "Admin",
            "Vendor Registration Successfully Approved",
            """
            Dear Admin,

            A Vendor Registration Request has been successfully approved and completed.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Vendor Code: [Vendor Code]
            • Final Approved By: [Final Approver Name]

            The approved vendor registration document is now available for download in the system.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Request ID],[Vendor Name],[Vendor Code],[Final Approver Name]"),

        new Definition(
            EmailTemplateCodes.ApproverResubmitted,
            "Approver – Resubmitted Request Notification",
            "Approver",
            "Vendor Registration Request Resubmitted for Approval",
            """
            Dear [Approver Name],

            A Vendor Registration Request has been resubmitted after modification and is pending for your review.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Resubmitted By: [Buyer Name]
            • Revision Number: REV [Revision Number]
            • Resubmission Date: [Date & Time]

            Updated details have been modified based on the previous rejection comments.

            Please review the updated request and take the necessary action in the Andritz Vendor Registration Portal.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Approver Name],[Request ID],[Vendor Name],[Buyer Name],[Revision Number],[Date & Time]"),

        new Definition(
            EmailTemplateCodes.BuyerResubmissionConfirmation,
            "Buyer – Resubmission Confirmation",
            "Buyer",
            "Vendor Registration Request Resubmitted Successfully",
            """
            Dear [Buyer Name],

            Your Vendor Registration Request has been successfully updated and resubmitted for approval.

            Request Details:
            • Request ID: [Request ID]
            • Vendor Name: [Vendor Name]
            • Revision Number: REV [Revision Number]
            • Resubmission Date: [Date & Time]

            The request has now been forwarded again to the approver(s) for review.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Buyer Name],[Request ID],[Vendor Name],[Revision Number],[Date & Time]"),

        new Definition(
            EmailTemplateCodes.BuyerInvitation,
            "Buyer – Account Invitation",
            "Buyer",
            "Welcome to the Andritz Vendor Registration Portal",
            """
            Dear [Buyer Name],

            Your Buyer account has been created in the Andritz Vendor Registration Portal.

            Account Details:
            • Full Name: [Buyer Name]
            • Email: [Email]
            • Role: Buyer
            • Portal URL: [Portal URL]

            You can now sign in to create and track vendor registration requests.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Buyer Name],[Email],[Portal URL]"),

        new Definition(
            EmailTemplateCodes.ApproverInvitation,
            "Approver – Account Invitation",
            "Approver",
            "Welcome to the Andritz Vendor Registration Portal",
            """
            Dear [Approver Name],

            Your Approver account has been created in the Andritz Vendor Registration Portal.

            Account Details:
            • Full Name: [Approver Name]
            • Email: [Email]
            • Role: Approver
            • Portal URL: [Portal URL]

            Vendor registration requests assigned to you for review will appear in your Pending Approval queue once you sign in.

            Regards,
            Andritz Vendor Registration System
            """,
            "[Approver Name],[Email],[Portal URL]"),
    ];
}
