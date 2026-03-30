using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace AndritzVendorPortal.API.Infrastructure;

public class SmtpEmailService(
    IOptions<EmailSettings> options,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    private readonly EmailSettings _cfg = options.Value;

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        // Silently skip if SMTP is not configured (dev / placeholder credentials)
        if (string.IsNullOrWhiteSpace(_cfg.Host) ||
            string.IsNullOrWhiteSpace(_cfg.Username))
        {
            logger.LogInformation(
                "[Email] SMTP not configured — skipping email to {To}: {Subject}", to, subject);
            return;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_cfg.FromName, _cfg.FromEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body    = new TextPart("html") { Text = htmlBody };

            using var client = new SmtpClient();
            await client.ConnectAsync(
                _cfg.Host, _cfg.Port,
                _cfg.UseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None);
            await client.AuthenticateAsync(_cfg.Username, _cfg.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(quit: true);

            logger.LogInformation("[Email] Sent to {To}: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            // Email failure must never block workflow — log and continue
            logger.LogError(ex, "[Email] Failed to send to {To}: {Subject}", to, subject);
        }
    }
}
