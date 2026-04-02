namespace AndritzVendorPortal.API.Infrastructure;

/// <summary>
/// Branded HTML email templates for every vendor-request workflow event.
/// Each method returns a (subject, htmlBody) tuple ready to pass to IEmailService.
/// </summary>
public static class EmailTemplates
{
    // ── Shared layout ─────────────────────────────────────────────────────────

    private static string Wrap(string title, string preheader, string bodyHtml) => $"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
        </head>
        <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
          <!-- Preheader (hidden preview text) -->
          <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}</span>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#064e80 0%,#096fb3 100%);padding:28px 36px;">
                    <p style="margin:0;color:#ffffff;font-family:'Barlow Condensed',Arial,sans-serif;font-weight:900;font-size:22px;letter-spacing:.18em;">ANDRITZ</p>
                    <p style="margin:4px 0 0;color:rgba(255,255,255,.6);font-size:11px;letter-spacing:.3em;text-transform:uppercase;">KYC · Vendor Onboarding &amp; Compliance</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:32px 36px;">
                    {bodyHtml}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f8f9fa;padding:20px 36px;border-top:1px solid #e9ecef;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                      This is an automated notification from the <strong>Andritz Vendor Portal</strong>.<br/>
                      Please do not reply to this email.
                    </p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;

    /// <summary>Renders a two-column info table row (label | value).</summary>
    private static string Row(string label, string value) =>
        $"""<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">{label}</td><td style="padding:6px 0;color:#111827;font-size:13px;font-weight:500;">{HtmlEncode(value)}</td></tr>""";

    private static string HtmlEncode(string s) =>
        System.Net.WebUtility.HtmlEncode(s);

    private static string VendorTable(VendorSummary v) => $"""
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
          {Row("Vendor Name",    v.VendorName)}
          {Row("Material Group", v.MaterialGroup)}
          {Row("GST / PAN",      $"{v.GstNumber} / {v.PanCard}")}
          {Row("Location",       $"{v.City}, {v.State}, {v.Country}")}
          {Row("Submitted by",   v.BuyerName)}
          {(v.RevisionNo > 0 ? Row("Revision", $"REV {v.RevisionNo}") : "")}
        </table>
        """;

    private static string StatusBadge(string label, string color) =>
        $"""<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:{color};color:#fff;font-size:12px;font-weight:600;">{label}</span>""";

    private static string ActionButton(string text, string href) =>
        $"""<a href="{href}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#096fb3;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">{text}</a>""";

    // ── Summary record passed into each template ───────────────────────────────

    public record VendorSummary(
        int    Id,
        string VendorName,
        string MaterialGroup,
        string GstNumber,
        string PanCard,
        string City,
        string State,
        string Country,
        string BuyerName,
        int    RevisionNo);

    // ── 1. New submission ─────────────────────────────────────────────────────

    /// <summary>
    /// Sent to: first approver(s) + admin
    /// Trigger: Buyer submits a Draft request → PendingApproval
    /// </summary>
    public static (string Subject, string Body) NewSubmission(
        VendorSummary v, string approverName, string portalUrl)
    {
        var subject = $"[Action Required] New vendor request: {v.VendorName}";
        var body = Wrap(subject, $"A new vendor request for {v.VendorName} needs your approval.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {HtmlEncode(approverName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">New vendor request submitted</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              A new vendor onboarding request has been submitted and is awaiting your review.
            </p>
            {StatusBadge("Pending Approval", "#f59e0b")}
            {VendorTable(v)}
            {ActionButton("Review Request", portalUrl)}
            """);
        return (subject, body);
    }

    // ── 2. Intermediate approval ──────────────────────────────────────────────

    /// <summary>
    /// Sent to: buyer + next approver (if any) + admin
    /// Trigger: an intermediate Approver approves a step
    /// </summary>
    public static (string Subject, string Body) StepApproved(
        VendorSummary v, string approvedByName, string? nextApproverName, string portalUrl)
    {
        var subject = $"[Update] {v.VendorName} approved by {approvedByName}";
        var nextLine = nextApproverName is not null
            ? $"<p style=\"margin:16px 0 0;color:#374151;font-size:14px;\">The request is now pending review by <strong>{HtmlEncode(nextApproverName)}</strong>.</p>"
            : "";
        var body = Wrap(subject, $"{v.VendorName} has been approved by {approvedByName}.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Approval step completed</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>{HtmlEncode(approvedByName)}</strong> has approved the vendor request.
            </p>
            {StatusBadge("Approved", "#10b981")}
            {VendorTable(v)}
            {nextLine}
            {ActionButton("View Request", portalUrl)}
            """);
        return (subject, body);
    }

    // ── 3. Ready for final approval ───────────────────────────────────────────

    /// <summary>
    /// Sent to: FinalApprover (Pardeep Sharma) + admin
    /// Trigger: all intermediate steps approved → PendingFinalApproval
    /// </summary>
    public static (string Subject, string Body) ReadyForFinalApproval(
        VendorSummary v, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — ready for final approval";
        var body = Wrap(subject, $"{v.VendorName} has cleared all intermediate approvals and needs your final decision.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi Pardeep,</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Final approval required</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              All intermediate approvers have approved this vendor request.
              Please review and assign the SAP Vendor Code to complete onboarding.
            </p>
            {StatusBadge("Pending Final Approval", "#8b5cf6")}
            {VendorTable(v)}
            {ActionButton("Review &amp; Assign SAP Code", portalUrl)}
            """);
        return (subject, body);
    }

    // ── 4. Rejected ───────────────────────────────────────────────────────────

    /// <summary>
    /// Sent to: buyer + admin
    /// Trigger: any Approver or FinalApprover rejects the request
    /// </summary>
    public static (string Subject, string Body) Rejected(
        VendorSummary v, string rejectedByName, string comment, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — rejected, revision needed";
        var body = Wrap(subject, $"{v.VendorName} was rejected by {rejectedByName}. Please review and resubmit.", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vendor request rejected</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>{HtmlEncode(rejectedByName)}</strong> has rejected this vendor request.
              Please address the feedback below and resubmit.
            </p>
            {StatusBadge("Rejected", "#ef4444")}
            {VendorTable(v)}
            <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-left:3px solid #ef4444;padding-left:12px;">
              <tr><td style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Rejection Comment</td></tr>
              <tr><td style="color:#374151;font-size:14px;padding-top:4px;">{HtmlEncode(comment)}</td></tr>
            </table>
            {ActionButton("Revise &amp; Resubmit", portalUrl)}
            """);
        return (subject, body);
    }

    // ── 5. Resubmission ───────────────────────────────────────────────────────

    /// <summary>
    /// Sent to: first approver(s) + admin
    /// Trigger: Buyer resubmits a Rejected request (RevisionNo incremented)
    /// </summary>
    public static (string Subject, string Body) Resubmitted(
        VendorSummary v, string approverName, string portalUrl)
    {
        var subject = $"[Action Required] {v.VendorName} — resubmitted (REV {v.RevisionNo})";
        var body = Wrap(subject, $"{v.VendorName} has been revised and resubmitted for your review.", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {HtmlEncode(approverName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vendor request resubmitted</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              The buyer has addressed the rejection feedback and resubmitted the request for review.
            </p>
            {StatusBadge($"REV {v.RevisionNo} — Pending Approval", "#f59e0b")}
            {VendorTable(v)}
            {ActionButton("Review Updated Request", portalUrl)}
            """);
        return (subject, body);
    }

    // ── 6. Welcome new user ───────────────────────────────────────────────────

    /// <summary>
    /// Sent to: newly created user
    /// Trigger: Admin creates a new user account
    /// </summary>
    public static (string Subject, string Body) WelcomeUser(
        string fullName, string email, string role, string portalUrl)
    {
        var subject = "Welcome to the Andritz Vendor Portal";
        var body = Wrap(subject, $"Your account has been created. Sign in at {portalUrl}", $"""
            <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">Hi {HtmlEncode(fullName)},</p>
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Welcome to the Andritz Vendor Portal</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              Your account has been created by the Administrator. You can now sign in using your email address.
            </p>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
              {Row("Email",    email)}
              {Row("Role",     role)}
            </table>
            {ActionButton("Sign In to Portal", portalUrl)}
            <p style="margin:16px 0 0;color:#6b7280;font-size:12px;">
              If you did not expect this email, please contact your administrator.
            </p>
            """);
        return (subject, body);
    }

    // ── 7. Completed ─────────────────────────────────────────────────────────

    /// <summary>
    /// Sent to: buyer + admin
    /// Trigger: FinalApprover completes and assigns the SAP vendor code
    /// </summary>
    public static (string Subject, string Body) Completed(
        VendorSummary v, string vendorCode, string assignedByName, string portalUrl)
    {
        var subject = $"[Completed] {v.VendorName} — SAP Vendor Code assigned: {vendorCode}";
        var body = Wrap(subject, $"{v.VendorName} is fully approved. SAP Vendor Code: {vendorCode}", $"""
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vendor onboarding complete</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
              <strong>{HtmlEncode(v.VendorName)}</strong> has been fully approved and onboarded into SAP.
            </p>
            {StatusBadge("Completed", "#10b981")}
            {VendorTable(v)}
            <table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;">
              <tr><td style="color:#065f46;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:12px 16px 4px;">SAP Vendor Code</td></tr>
              <tr><td style="color:#064e3b;font-family:monospace;font-size:20px;font-weight:700;padding:4px 16px 12px;">{HtmlEncode(vendorCode)}</td></tr>
            </table>
            <p style="margin:0;color:#6b7280;font-size:13px;">Assigned by <strong>{HtmlEncode(assignedByName)}</strong></p>
            {ActionButton("View Vendor Record", portalUrl)}
            """);
        return (subject, body);
    }
}
