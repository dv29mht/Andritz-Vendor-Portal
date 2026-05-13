namespace AndritzVendorPortal.Application.Interfaces;

public record EmailAttachment(string FileName, byte[] Content, string ContentType = "application/pdf");

public interface IEmailService
{
    /// <summary>Sends an HTML email. Never throws — failures are logged and swallowed.</summary>
    Task SendAsync(string to, string subject, string htmlBody);

    /// <summary>Sends an HTML email with attachments. Never throws — failures are logged and swallowed.</summary>
    Task SendAsync(string to, string subject, string htmlBody, IReadOnlyList<EmailAttachment>? attachments);
}
