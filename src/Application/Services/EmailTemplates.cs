namespace AndritzVendorPortal.Application.Services;

/// <summary>
/// Branded HTML email templates for vendor-request workflow events.
/// Pure functions — no I/O, no DI. Safe to call from any handler.
/// </summary>
public static class EmailTemplates
{
    public record VendorSummary(
        int Id,
        string VendorName,
        string MaterialGroup,
        string GstNumber,
        string PanCard,
        string City,
        string State,
        string Country,
        string BuyerName,
        int RevisionNo);

    private static string Wrap(string title, string preheader, string bodyHtml) => $"""
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"/><title>{title}</title></head>
        <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
          <span style="display:none;max-height:0;overflow:hidden;">{preheader}</span>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                <tr><td style="background:linear-gradient(135deg,#064e80 0%,#096fb3 100%);padding:28px 36px;">
                  <p style="margin:0;color:#fff;font-weight:900;font-size:22px;letter-spacing:.18em;">ANDRITZ</p>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,.6);font-size:11px;letter-spacing:.3em;text-transform:uppercase;">Vendor Onboarding &amp; Compliance</p>
                </td></tr>
                <tr><td style="padding:32px 36px;">{bodyHtml}</td></tr>
                <tr><td style="background:#f8f9fa;padding:20px 36px;border-top:1px solid #e9ecef;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">Automated notification from the Andritz Vendor Portal. Do not reply.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body></html>
        """;

    private static string Row(string label, string value) =>
        $"""<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;vertical-align:top;">{label}</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">{Enc(value)}</td></tr>""";

    private static string Enc(string s) => System.Net.WebUtility.HtmlEncode(s);

    private static string VendorTable(VendorSummary v) => $"""
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
          {Row("Vendor Name", v.VendorName)}
          {Row("Material Group", v.MaterialGroup)}
          {Row("GST / PAN", $"{v.GstNumber} / {v.PanCard}")}
          {Row("Location", $"{v.City}, {v.State}, {v.Country}")}
          {Row("Submitted by", v.BuyerName)}
          {(v.RevisionNo > 0 ? Row("Revision", $"REV {v.RevisionNo}") : "")}
        </table>
        """;

    private static string Badge(string label, string color) =>
        $"""<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:{color};color:#fff;font-size:12px;font-weight:600;">{label}</span>""";

    private static string Btn(string text, string href) =>
        $"""<a href="{href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#096fb3;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">{text}</a>""";

    public static (string Subject, string Body) NewSubmission(VendorSummary v, string approverName, string portalUrl)
    {
        var subject = $"[Action Required] New vendor request: {v.VendorName}";
        return (subject, Wrap(subject, $"A new vendor request for {v.VendorName} needs your approval.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {Enc(approverName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">New vendor request submitted</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">A new vendor onboarding request has been submitted and is awaiting your review.</p>
            {Badge("Pending Approval", "#f59e0b")}{VendorTable(v)}{Btn("Review Request", portalUrl)}
            """));
    }

    public static (string Subject, string Body) StepApproved(VendorSummary v, string by, string? next, string portalUrl)
    {
        var subject = $"[Update] {v.VendorName} approved by {by}";
        var nextLine = next is not null
            ? $"<p style=\"margin:16px 0 0;color:#374151;font-size:14px;\">Now pending review by <strong>{Enc(next)}</strong>.</p>"
            : "";
        return (subject, Wrap(subject, $"{v.VendorName} approved by {by}.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Approval step completed</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;"><strong>{Enc(by)}</strong> has approved the vendor request.</p>
            {Badge("Approved", "#10b981")}{VendorTable(v)}{nextLine}{Btn("View Request", portalUrl)}
            """));
    }

    public static (string Subject, string Body) ReadyForFinalApproval(VendorSummary v, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — ready for final approval";
        return (subject, Wrap(subject, "Cleared all intermediate approvals.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Final approval required</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">All intermediate approvers have approved this vendor request. Please review and assign the SAP Vendor Code.</p>
            {Badge("Pending Final Approval", "#8b5cf6")}{VendorTable(v)}{Btn("Review &amp; Assign SAP Code", portalUrl)}
            """));
    }

    public static (string Subject, string Body) Rejected(VendorSummary v, string by, string comment, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — rejected, revision needed";
        return (subject, Wrap(subject, $"Rejected by {by}.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vendor request rejected</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;"><strong>{Enc(by)}</strong> has rejected this vendor request.</p>
            {Badge("Rejected", "#ef4444")}{VendorTable(v)}
            <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-left:3px solid #ef4444;padding-left:12px;">
              <tr><td style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Rejection Comment</td></tr>
              <tr><td style="color:#374151;font-size:14px;padding-top:4px;">{Enc(comment)}</td></tr>
            </table>{Btn("Revise &amp; Resubmit", portalUrl)}
            """));
    }

    public static (string Subject, string Body) Resubmitted(VendorSummary v, string approverName, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — resubmitted (REV {v.RevisionNo})";
        return (subject, Wrap(subject, "Resubmitted for review.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {Enc(approverName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vendor request resubmitted</h2>
            {Badge($"REV {v.RevisionNo} — Pending Approval", "#f59e0b")}{VendorTable(v)}{Btn("Review Updated Request", portalUrl)}
            """));
    }

    public static (string Subject, string Body) PasswordReset(string fullName, string resetLink)
    {
        var subject = "Reset your Andritz Vendor Portal password";
        return (subject, Wrap(subject, "Password reset link inside.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {Enc(fullName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Reset your password</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">We received a request to reset your password. Click below. This link expires in <strong>1 hour</strong>.</p>
            {Btn("Reset Password", resetLink)}
            <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">If you did not request a password reset, ignore this email.</p>
            """));
    }

    public static (string Subject, string Body) SubmissionConfirmed(VendorSummary v, string portalUrl)
    {
        var subject = $"[Submitted] Your vendor request for {v.VendorName} has been submitted";
        return (subject, Wrap(subject, "Submitted to approval queue.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Request submitted successfully</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Your vendor onboarding request is now in the approval queue.</p>
            {Badge("Pending Approval", "#f59e0b")}{VendorTable(v)}{Btn("Track Request", portalUrl)}
            """));
    }

    public static (string Subject, string Body) WelcomeUser(string fullName, string email, string role, string portalUrl)
    {
        var subject = "Welcome to the Andritz Vendor Portal";
        return (subject, Wrap(subject, "Account created.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {Enc(fullName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Welcome</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">Your account has been created by the Administrator.</p>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
              {Row("Email", email)}{Row("Role", role)}
            </table>{Btn("Sign In to Portal", portalUrl)}
            """));
    }

    public static (string Subject, string Body) CompletedReEditSubmitted(VendorSummary v, string approverName, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — re-submitted (REV {v.RevisionNo})";
        return (subject, Wrap(subject, "Updated and re-submitted.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {Enc(approverName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Completed vendor request re-submitted</h2>
            {Badge($"REV {v.RevisionNo} — Pending Re-Approval", "#f59e0b")}{VendorTable(v)}{Btn("Review Updated Request", portalUrl)}
            """));
    }

    public static (string Subject, string Body) CompletedReEditConfirmed(VendorSummary v, string portalUrl)
    {
        var subject = $"[Re-submitted] Your updated request for {v.VendorName}";
        return (subject, Wrap(subject, "Re-entered approval queue.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Request re-submitted successfully</h2>
            {Badge($"REV {v.RevisionNo} — Pending Re-Approval", "#f59e0b")}{VendorTable(v)}{Btn("View Request", portalUrl)}
            """));
    }

    public static (string Subject, string Body) Completed(VendorSummary v, string vendorCode, string assignedBy, string portalUrl)
    {
        var subject = $"[Completed] {v.VendorName} — SAP Vendor Code: {vendorCode}";
        return (subject, Wrap(subject, $"SAP Code {vendorCode} assigned.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vendor onboarding complete</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;"><strong>{Enc(v.VendorName)}</strong> is fully onboarded.</p>
            {Badge("Completed", "#10b981")}{VendorTable(v)}
            <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
              <tr><td style="color:#065f46;font-size:13px;font-weight:600;text-transform:uppercase;padding:12px 16px 4px;">SAP Vendor Code</td></tr>
              <tr><td style="color:#064e3b;font-family:monospace;font-size:20px;font-weight:700;padding:4px 16px 12px;">{Enc(vendorCode)}</td></tr>
            </table>
            <p style="margin:0;color:#6b7280;font-size:13px;">Assigned by <strong>{Enc(assignedBy)}</strong></p>
            {Btn("View Vendor Record", portalUrl)}
            """));
    }
}
