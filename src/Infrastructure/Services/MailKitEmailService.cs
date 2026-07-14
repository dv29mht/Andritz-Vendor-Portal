using AndritzVendorPortal.Application.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// SMTP transport for the internal Andritz relay (mail.andritz.com:25), on MailKit.
///
/// <para>It replaces System.Net.Mail.SmtpClient, which is obsolete (SYSLIB0014) and — the actual
/// production bug — honours its <c>Timeout</c> property only on the synchronous <c>Send()</c>.
/// The async path ignored it completely, so <c>await client.SendMailAsync(...)</c> against a
/// stalled relay hung for as long as the relay stayed silent: approvals were observed running
/// 441 s and 625 s, ending only when the browser gave up. MailKit honours both a timeout and a
/// CancellationToken on the async path.</para>
///
/// <para>Called only from the outbox dispatcher (and the admin diagnostic endpoint) — never from
/// a request thread.</para>
/// </summary>
public class MailKitEmailService(
    IOptions<EmailSettings> options,
    ILogger<MailKitEmailService> logger) : IEmailService
{
    private readonly EmailSettings _cfg = options.Value;

    public async Task SendAsync(
        string to,
        string subject,
        string htmlBody,
        IReadOnlyList<EmailAttachment>? attachments = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_cfg.Host))
        {
            logger.LogInformation("[Email] SMTP Host missing — skipping email to {To}: {Subject}", to, subject);
            return;
        }

        var timeout = TimeSpan.FromSeconds(Math.Max(1, _cfg.TimeoutSeconds));

        // Two independent bounds, because "no mail call may hang forever" has to hold even if
        // the transport misbehaves:
        //   1. a linked token that fires after `timeout`, which MailKit observes and uses to tear
        //      the socket down; and
        //   2. WaitAsync, which returns control to the dispatcher on a slightly longer deadline
        //      even in the pathological case where MailKit does not observe the token at all.
        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(timeout);

        try
        {
            await SendCoreAsync(to, subject, htmlBody, attachments, timeout, timeoutCts.Token)
                .WaitAsync(timeout + TimeSpan.FromSeconds(5), ct);

            logger.LogInformation("[Email] Sent to {To}: {Subject}", to, subject);
        }
        catch (Exception ex) when (ex is TimeoutException or OperationCanceledException
                                   && !ct.IsCancellationRequested)
        {
            // The caller didn't cancel us — the relay did not answer in time.
            throw new TimeoutException(
                $"SMTP send to {to} exceeded {timeout.TotalSeconds:0}s ({_cfg.Host}:{_cfg.Port}).", ex);
        }
    }

    private async Task SendCoreAsync(
        string to,
        string subject,
        string htmlBody,
        IReadOnlyList<EmailAttachment>? attachments,
        TimeSpan timeout,
        CancellationToken ct)
    {
        var message = new MimeMessage
        {
            Subject = subject,
        };
        message.From.Add(new MailboxAddress(_cfg.FromName, _cfg.FromEmail));
        message.To.Add(MailboxAddress.Parse(to));

        var body = new BodyBuilder { HtmlBody = htmlBody };
        if (attachments is { Count: > 0 })
        {
            foreach (var a in attachments)
                body.Attachments.Add(a.FileName, a.Content, ContentType.Parse(a.ContentType));
        }
        message.Body = body.ToMessageBody();

        using var client = new SmtpClient
        {
            // MailKit applies this to the socket read/write operations underneath the async path
            // too — the guarantee System.Net.Mail never gave us.
            Timeout = (int)timeout.TotalMilliseconds,
        };

        // EnableSsl=false → SecureSocketOptions.None. The internal relay does not advertise
        // STARTTLS on port 25; do not "fix" this to StartTls or Auto (see 45cc7eb) — Auto would
        // opportunistically upgrade and break every send.
        var security = _cfg.EnableSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None;

        await client.ConnectAsync(_cfg.Host, _cfg.Port, security, ct);
        if (!string.IsNullOrEmpty(_cfg.Username))
            await client.AuthenticateAsync(_cfg.Username, _cfg.Password, ct);

        await client.SendAsync(message, ct);

        // The relay has accepted the message by this point. A QUIT that then times out must not
        // fail the send — that would have the dispatcher retry a mail the relay already took.
        try { await client.DisconnectAsync(quit: true, ct); }
        catch (Exception ex) { logger.LogDebug(ex, "[Email] SMTP disconnect failed after a successful send to {To}", to); }
    }
}
