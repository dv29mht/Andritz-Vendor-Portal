using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Infrastructure.Services;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MimeKit;
using System.Diagnostics;
using System.Net.Sockets;

namespace AndritzVendorPortal.API.Controllers;

// Test-send endpoint that BYPASSES SmtpEmailService's exception swallowing
// and returns the full SMTP error chain to the admin caller, so production
// SMTP issues can be diagnosed without server/log access. Optional query
// overrides let an admin try ssl=false / auth=off / different ports without
// a redeploy. Password is never echoed back.
public record EmailDiagnosticRequest(
    string To,
    bool? EnableSsl,
    bool? UseAuth,
    int? Port,
    string? Host);

public record EmailDiagnosticResponse(
    bool Sent,
    long ElapsedMs,
    EmailDiagnosticConfig Config,
    EmailDiagnosticError? Error,
    string? Hint);

public record EmailDiagnosticConfig(
    string Host,
    int Port,
    bool EnableSsl,
    bool UsingAuth,
    string Username,
    string FromEmail,
    string FromName);

public record EmailDiagnosticError(
    string Type,
    string Message,
    string? SmtpStatusCode,
    string? SocketErrorCode,
    IReadOnlyList<string> Chain,
    string? StackTrace);

[ApiController]
[Route("api/email-diagnostics")]
[Authorize(Roles = Roles.FinalApprover)]
public class EmailDiagnosticsController(IOptions<EmailSettings> options) : ControllerBase
{
    private readonly EmailSettings _cfg = options.Value;

    [HttpPost("test")]
    public async Task<ActionResult<Result<EmailDiagnosticResponse>>> Test([FromBody] EmailDiagnosticRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.To))
            return BadRequest(Result<EmailDiagnosticResponse>.Fail("Recipient 'to' is required."));

        var host = string.IsNullOrWhiteSpace(req.Host) ? _cfg.Host : req.Host;
        var port = req.Port ?? _cfg.Port;
        var ssl = req.EnableSsl ?? _cfg.EnableSsl;
        var useAuth = req.UseAuth ?? !string.IsNullOrEmpty(_cfg.Username);

        var resolved = new EmailDiagnosticConfig(
            Host: host,
            Port: port,
            EnableSsl: ssl,
            UsingAuth: useAuth,
            Username: _cfg.Username ?? string.Empty,
            FromEmail: _cfg.FromEmail,
            FromName: _cfg.FromName);

        // Bounded, like every other send in the app. This endpoint exists to diagnose a sick
        // relay, so it is precisely the call that must not hang: on System.Net.Mail the Timeout
        // below was silently ignored on the async path, and a black-holed relay would hold this
        // request open until the browser gave up.
        var timeout = TimeSpan.FromSeconds(Math.Max(1, _cfg.TimeoutSeconds));
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(HttpContext.RequestAborted);
        cts.CancelAfter(timeout);

        var sw = Stopwatch.StartNew();
        try
        {
            var message = new MimeMessage
            {
                Subject = $"[SOT] SMTP diagnostic ({DateTime.UtcNow:O})",
                Body = new TextPart("plain")
                {
                    Text = $"Diagnostic test send.\nHost={host}\nPort={port}\nEnableSsl={ssl}\nUsingAuth={useAuth}",
                },
            };
            message.From.Add(new MailboxAddress(_cfg.FromName, _cfg.FromEmail));
            message.To.Add(MailboxAddress.Parse(req.To));

            using var client = new SmtpClient { Timeout = (int)timeout.TotalMilliseconds };

            await client.ConnectAsync(host, port, ssl ? SecureSocketOptions.StartTls : SecureSocketOptions.None, cts.Token);
            if (useAuth)
                await client.AuthenticateAsync(_cfg.Username ?? string.Empty, _cfg.Password ?? string.Empty, cts.Token);
            await client.SendAsync(message, cts.Token);
            await client.DisconnectAsync(quit: true, cts.Token);

            sw.Stop();

            return Ok(Result<EmailDiagnosticResponse>.Ok(
                new EmailDiagnosticResponse(true, sw.ElapsedMilliseconds, resolved, null, null),
                "Test email accepted by SMTP server."));
        }
        catch (Exception ex)
        {
            sw.Stop();
            var chain = new List<string>();
            string? smtpStatus = null;
            string? socketError = null;
            for (var cur = ex; cur is not null; cur = cur.InnerException)
            {
                chain.Add($"{cur.GetType().FullName}: {cur.Message}");
                if (smtpStatus is null && cur is SmtpCommandException se)
                    smtpStatus = se.StatusCode.ToString();
                if (socketError is null && cur is SocketException sock)
                    socketError = $"{sock.SocketErrorCode} ({sock.ErrorCode})";
            }

            var err = new EmailDiagnosticError(
                Type: ex.GetType().FullName ?? ex.GetType().Name,
                Message: ex.Message,
                SmtpStatusCode: smtpStatus,
                SocketErrorCode: socketError,
                Chain: chain,
                StackTrace: ex.StackTrace);

            var hint = BuildHint(ex, useAuth, port, timeout, HttpContext.RequestAborted.IsCancellationRequested);

            return Ok(Result<EmailDiagnosticResponse>.Ok(
                new EmailDiagnosticResponse(false, sw.ElapsedMilliseconds, resolved, err, hint),
                "Test send failed."));
        }
    }

    private static string? BuildHint(Exception ex, bool useAuth, int port, TimeSpan timeout, bool clientAborted)
    {
        var msg = ex.Message ?? string.Empty;
        var inner = ex.InnerException?.Message ?? string.Empty;
        var combined = $"{msg} | {inner}";

        // RequestAborted is linked into the CTS above, so an admin who closes the tab mid-test
        // unwinds as an OperationCanceledException — the same exception the timeout raises. On an
        // endpoint whose whole job is correct attribution, that must not be reported as a stalled
        // relay: it would send someone to chase a relay that is perfectly healthy. Check the abort
        // first, because it is the one cause we can identify with certainty.
        if (clientAborted)
            return "The test was cancelled before the relay answered — the browser disconnected " +
                   "(tab closed, navigated away, or a proxy timed the request out). This says nothing " +
                   "about the relay. Re-run it and leave the page open.";

        // A relay that accepts the TCP connection and then never speaks is exactly the shape of
        // the July production incident. Name it, because the symptom (a slow app) looks nothing
        // like the cause (a silent relay).
        if (ex is TimeoutException or OperationCanceledException)
            return $"The relay accepted the connection but did not answer within {timeout.TotalSeconds:0}s. " +
                   "Mail is queued in the outbox and retried in the background, so the portal stays responsive — " +
                   "but delivery is stalled until the relay responds. Check the relay with IT.";
        if (combined.Contains("does not support the STARTTLS", StringComparison.OrdinalIgnoreCase)
            || combined.Contains("does not support secure", StringComparison.OrdinalIgnoreCase))
            return "Relay does not advertise STARTTLS on this port. Try with EnableSsl=false (port 25 internal relays usually don't offer TLS).";
        if (ex is System.Security.Authentication.AuthenticationException
            || (ex is SmtpCommandException auth && auth.StatusCode is SmtpStatusCode.AuthenticationRequired
                    or SmtpStatusCode.AuthenticationInvalidCredentials
                    or SmtpStatusCode.AuthenticationMechanismTooWeak))
            return useAuth
                ? "Credentials rejected. Verify the username/password with IT, or try UseAuth=false if the relay allows anonymous internal sending."
                : "Server requires authentication. Try UseAuth=true.";
        if (ex is SmtpCommandException mailbox && mailbox.StatusCode is SmtpStatusCode.MailboxUnavailable
                or SmtpStatusCode.MailboxNameNotAllowed)
            return "Relay refused the From or To address. The relay may not allow this app's FROM address, or the recipient domain is blocked.";
        if (ex is SocketException || ex.InnerException is SocketException)
            return $"TCP connection to relay failed. Check that the production server can reach the SMTP host on port {port} (firewall, DNS, or wrong hostname).";
        if (combined.Contains("certificate", StringComparison.OrdinalIgnoreCase))
            return "TLS certificate validation failed. The relay's cert may be self-signed or expired.";
        return null;
    }
}
