using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Net;
using System.Net.Mail;
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

        var sw = Stopwatch.StartNew();
        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(_cfg.FromEmail, _cfg.FromName),
                Subject = $"[SOT] SMTP diagnostic ({DateTime.UtcNow:O})",
                Body = $"Diagnostic test send.\nHost={host}\nPort={port}\nEnableSsl={ssl}\nUsingAuth={useAuth}",
                IsBodyHtml = false
            };
            message.To.Add(new MailAddress(req.To));

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = ssl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = useAuth
                    ? new NetworkCredential(_cfg.Username, _cfg.Password)
                    : null,
                Timeout = 15000
            };

            await client.SendMailAsync(message);
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
                if (smtpStatus is null && cur is SmtpException se)
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

            return Ok(Result<EmailDiagnosticResponse>.Ok(
                new EmailDiagnosticResponse(false, sw.ElapsedMilliseconds, resolved, err, BuildHint(ex, ssl, useAuth, port)),
                "Test send failed."));
        }
    }

    private static string? BuildHint(Exception ex, bool ssl, bool useAuth, int port)
    {
        var msg = ex.Message ?? string.Empty;
        var inner = ex.InnerException?.Message ?? string.Empty;
        var combined = $"{msg} | {inner}";

        if (combined.Contains("does not support secure", StringComparison.OrdinalIgnoreCase))
            return "Relay does not advertise STARTTLS on this port. Try with EnableSsl=false (port 25 internal relays usually don't offer TLS).";
        if (combined.Contains("authentication", StringComparison.OrdinalIgnoreCase)
            || (ex is SmtpException se1 && se1.StatusCode == SmtpStatusCode.MustIssueStartTlsFirst))
            return useAuth
                ? "Credentials rejected. Verify the username/password with IT, or try UseAuth=false if the relay allows anonymous internal sending."
                : "Server requires authentication. Try UseAuth=true.";
        if (ex is SmtpException se2 && (se2.StatusCode == SmtpStatusCode.MailboxUnavailable
            || se2.StatusCode == SmtpStatusCode.MailboxNameNotAllowed))
            return "Relay refused the From or To address. The relay may not allow this app's FROM address, or the recipient domain is blocked.";
        if (ex.InnerException is SocketException)
            return $"TCP connection to relay failed. Check that the production server can reach the SMTP host on port {port} (firewall, DNS, or wrong hostname).";
        if (combined.Contains("certificate", StringComparison.OrdinalIgnoreCase))
            return "TLS certificate validation failed. The relay's cert may be self-signed or expired.";
        if (combined.Contains("timed out", StringComparison.OrdinalIgnoreCase))
            return $"Connection timed out reaching {port}. Likely a firewall block or the relay is not listening on this port.";
        return null;
    }
}
