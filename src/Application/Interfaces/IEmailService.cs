namespace AndritzVendorPortal.Application.Interfaces;

public record EmailAttachment(string FileName, byte[] Content, string ContentType = "application/pdf");

/// <summary>
/// Low-level SMTP transport. Command handlers do NOT use this — they queue through
/// <see cref="IEmailOutbox"/>, and the OutboxEmailDispatcher is what calls this, off the
/// request thread. The only other caller is the admin SMTP diagnostic endpoint.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Sends an HTML email, with a hard upper bound on how long the call can take.
    /// <para>Unlike the old implementation this <em>throws</em> on failure rather than swallowing:
    /// the dispatcher needs to see the failure in order to retry it and, eventually, to record a
    /// permanent failure. Swallowing here is what made a dead relay look like a successful send.</para>
    /// </summary>
    Task SendAsync(
        string to,
        string subject,
        string htmlBody,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken ct = default);
}
