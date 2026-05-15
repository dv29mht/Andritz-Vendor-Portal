using AndritzVendorPortal.Domain.Common;

namespace AndritzVendorPortal.Domain.Entities;

/// <summary>
/// Editable email template. Identified by a stable <see cref="Code"/> string;
/// admins update the human Name / Subject / BodyText through the admin panel,
/// while the system renders it by Code from any workflow handler.
/// BodyText is plain text with [Placeholder] tokens — wrapped in the branded
/// HTML shell at send time.
/// </summary>
public class EmailTemplate : IAuditable
{
    public int Id { get; set; }

    /// <summary>Stable identifier (e.g. "BuyerRequestSubmitted"). Unique.</summary>
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string BodyText { get; set; } = string.Empty;

    /// <summary>Original seeded values — used by the "Reset to default" admin action.</summary>
    public string DefaultSubject { get; set; } = string.Empty;
    public string DefaultBodyText { get; set; } = string.Empty;

    /// <summary>Comma-separated list of supported placeholder tokens, e.g. "[Buyer Name],[Request ID]".</summary>
    public string Placeholders { get; set; } = string.Empty;

    /// <summary>Audience description shown in the admin UI (Buyer / Approver / Final Approver / Admin).</summary>
    public string Audience { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? ModifiedBy { get; set; }
}
