using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// The root cause, pinned down: System.Net.Mail.SmtpClient honours its <c>Timeout</c> only on the
/// synchronous <c>Send()</c>. The async path ignored it, so <c>await SendMailAsync(...)</c> against a
/// relay that accepts the TCP connection and then goes silent hung for as long as the relay stayed
/// silent — approvals were observed running 441 s and 625 s before the browser gave up.
///
/// <para>This points the MailKit implementation at exactly that: a socket that completes the TCP
/// handshake and never sends an SMTP greeting.</para>
/// </summary>
public class EmailSendBoundedTests
{
    /// <summary>A listener that accepts connections and then says nothing, forever.</summary>
    private sealed class BlackHoleRelay : IDisposable
    {
        private readonly TcpListener _listener;
        private readonly CancellationTokenSource _cts = new();
        private readonly List<TcpClient> _accepted = [];

        public int Port { get; }

        public BlackHoleRelay()
        {
            _listener = new TcpListener(IPAddress.Loopback, 0);
            _listener.Start();
            Port = ((IPEndPoint)_listener.LocalEndpoint).Port;

            _ = Task.Run(async () =>
            {
                try
                {
                    while (!_cts.IsCancellationRequested)
                    {
                        // Accept, hold the connection open, and never write a byte.
                        _accepted.Add(await _listener.AcceptTcpClientAsync(_cts.Token));
                    }
                }
                catch (OperationCanceledException) { }
                catch (ObjectDisposedException) { }
            });
        }

        public void Dispose()
        {
            _cts.Cancel();
            foreach (var client in _accepted) client.Dispose();
            _listener.Stop();
            _cts.Dispose();
        }
    }

    private static MailKitEmailService ServiceFor(int port, int timeoutSeconds) =>
        new(Options.Create(new EmailSettings
        {
            Host = "127.0.0.1",
            Port = port,
            Username = string.Empty,   // no AUTH — go straight to the greeting, which never arrives
            FromEmail = "sot@andritz.com",
            FromName = "Andritz Supplier Connect",
            EnableSsl = false,
            TimeoutSeconds = timeoutSeconds,
        }), NullLogger<MailKitEmailService>.Instance);

    [Fact]
    public async Task A_relay_that_accepts_and_never_replies_fails_fast_instead_of_hanging()
    {
        using var relay = new BlackHoleRelay();
        var email = ServiceFor(relay.Port, timeoutSeconds: 2);

        var sw = Stopwatch.StartNew();
        var ex = await Record.ExceptionAsync(() =>
            email.SendAsync("approver@andritz.com", "Approval required", "<p>hi</p>"));
        sw.Stop();

        // It must fail, and it must fail *promptly* — this is the assertion that the whole incident
        // turns on. Generous ceiling so the test can't flake on a loaded CI box; the point is that
        // it is bounded at all, not that it is bounded to the millisecond.
        Assert.NotNull(ex);
        Assert.IsType<TimeoutException>(ex);
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(15),
            $"Send took {sw.Elapsed.TotalSeconds:0.0}s against a black-holed relay — it is not bounded.");
    }

    [Fact]
    public async Task A_caller_cancellation_is_honoured_and_is_not_reported_as_a_timeout()
    {
        // The dispatcher passes its stopping token. On shutdown the send must unwind as a
        // cancellation so the row is left due and retried on the next boot, not recorded as a
        // permanent SMTP failure.
        using var relay = new BlackHoleRelay();
        var email = ServiceFor(relay.Port, timeoutSeconds: 30);

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(300));

        var sw = Stopwatch.StartNew();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            email.SendAsync("approver@andritz.com", "Approval required", "<p>hi</p>", null, cts.Token));
        sw.Stop();

        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(10),
            $"Cancellation took {sw.Elapsed.TotalSeconds:0.0}s to take effect.");
    }

    [Fact]
    public async Task An_unconfigured_host_is_a_no_op_rather_than_an_error()
    {
        var email = new MailKitEmailService(
            Options.Create(new EmailSettings { Host = string.Empty }),
            NullLogger<MailKitEmailService>.Instance);

        await email.SendAsync("someone@andritz.com", "subject", "<p>body</p>");
    }
}
