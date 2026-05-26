using AndritzVendorPortal.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// Sends transactional emails via SMTP (System.Net.Mail). Configured for the
/// office Andritz relay (mail.andritz.com:25). All exceptions are caught and
/// logged — email failures must not block business workflows.
/// </summary>
public class SmtpEmailService(
    IOptions<EmailSettings> options,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    private readonly EmailSettings _cfg = options.Value;

    public Task SendAsync(string to, string subject, string htmlBody) =>
        SendAsync(to, subject, htmlBody, null);

    public async Task SendAsync(string to, string subject, string htmlBody, IReadOnlyList<EmailAttachment>? attachments)
    {
        if (string.IsNullOrWhiteSpace(_cfg.Host))
        {
            logger.LogInformation("[Email] SMTP Host missing — skipping email to {To}: {Subject}", to, subject);
            return;
        }

        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_cfg.FromEmail, _cfg.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = System.Text.Encoding.UTF8,
                SubjectEncoding = System.Text.Encoding.UTF8
            };
            message.To.Add(new MailAddress(to));

            if (attachments is { Count: > 0 })
            {
                foreach (var a in attachments)
                {
                    var stream = new MemoryStream(a.Content);
                    var attachment = new Attachment(stream, a.FileName, a.ContentType);
                    message.Attachments.Add(attachment);
                }
            }

            using var client = new SmtpClient(_cfg.Host, _cfg.Port)
            {
                EnableSsl = _cfg.EnableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = string.IsNullOrEmpty(_cfg.Username)
                    ? null
                    : new NetworkCredential(_cfg.Username, _cfg.Password),
                Timeout = 15000
            };

            await client.SendMailAsync(message);
            logger.LogInformation("[Email] Sent to {To}: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Email] Failed to send to {To}: {Subject}", to, subject);
        }
    }
}
