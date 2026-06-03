namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Loads admin-editable email templates from storage, substitutes
/// [Placeholder] tokens, and wraps the result in the branded HTML shell.
/// </summary>
public interface IEmailTemplateService
{
    /// <summary>
    /// Renders the template identified by <paramref name="code"/>. Returns the
    /// substituted subject line and an HTML body ready for <see cref="IEmailService"/>.
    /// Placeholder values default to "—" when missing from <paramref name="values"/>.
    /// </summary>
    /// <param name="actionFooterHtml">
    /// Optional HTML snippet rendered after the template body and before the email footer.
    /// Used by approval-workflow handlers to inject Approve/Reject/View-in-Portal buttons
    /// while keeping the body text fully admin-editable.
    /// </param>
    Task<(string Subject, string HtmlBody)> RenderAsync(
        string code,
        IReadOnlyDictionary<string, string?> values,
        CancellationToken ct = default,
        string? actionFooterHtml = null);

    /// <summary>
    /// Drops any cached copy of the template so the next render reloads it from
    /// storage. Call after an admin edits or resets a template.
    /// </summary>
    void Invalidate(string code);
}
