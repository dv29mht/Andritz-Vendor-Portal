using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using AndritzVendorPortal.Application.Features.VendorRequests.Commands;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Infrastructure.Persistence.Repositories;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// The headline verification. Drives the real ApproveVendorRequestCommandHandler with SMTP pointed
/// at a black hole — a socket that completes the TCP handshake and then never speaks, which is what
/// the Andritz relay was doing.
///
/// <para>Before the fix this shape of relay held the request open for as long as the relay stayed
/// silent (approvals ran 312 s, and twice 441 s / 625 s). The handler must now return in
/// milliseconds, with the mail sitting in the outbox for the background dispatcher.</para>
/// </summary>
public class ApproveReturnsFastTests
{
    private sealed class BlackHoleRelay : IDisposable
    {
        private readonly TcpListener _listener;
        private readonly CancellationTokenSource _cts = new();

        public int Port { get; }

        public BlackHoleRelay()
        {
            _listener = new TcpListener(IPAddress.Loopback, 0);
            _listener.Start();
            Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
            _ = Task.Run(async () =>
            {
                try { while (!_cts.IsCancellationRequested) await _listener.AcceptTcpClientAsync(_cts.Token); }
                catch (OperationCanceledException) { }
                catch (ObjectDisposedException) { }
            });
        }

        public void Dispose()
        {
            _cts.Cancel();
            _listener.Stop();
            _cts.Dispose();
        }
    }

    private sealed class FixedClock : IDateTimeProvider
    {
        public DateTime UtcNow => new(2026, 7, 14, 9, 0, 0, DateTimeKind.Utc);
    }

    private sealed class FakeCurrentUser(string userId) : ICurrentUserService
    {
        public string? UserId => userId;
        public string? Email => $"{userId}@andritz.com";
        public string? FullName => $"User {userId}";
        public bool IsAuthenticated => true;
        public bool IsInRole(string role) => true;
        public string RequireUserId() => userId;
    }

    private static IConfiguration Config(int smtpPort) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["PortalUrl"] = "https://qnfsms025.andritz.com/SOT",
            ["ApiBaseUrl"] = "https://qnfsms025.andritz.com/SOT",
            ["JwtSettings:SecretKey"] = "Test-Only-Signing-Key-At-Least-32-Characters-Long",
            ["EmailSettings:Host"] = "127.0.0.1",
            ["EmailSettings:Port"] = smtpPort.ToString(),
        }).Build();

    [Fact]
    public async Task Approving_returns_immediately_even_when_the_smtp_relay_is_black_holed()
    {
        using var relay = new BlackHoleRelay();
        using var h = new TestDb();
        var config = Config(relay.Port);
        var clock = new FixedClock();

        // A request pending its first of two approvers, so approving fans out to the buyer AND the
        // next approver — the multi-recipient path that used to re-render the PDF per recipient.
        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
        };
        request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = "appr-1", ApproverName = "User appr-1", StepOrder = 1 });
        request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = "appr-2", ApproverName = "User appr-2", StepOrder = 2 });
        request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = "final", ApproverName = "Final", StepOrder = 3, IsFinalApproval = true });
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();

        var handler = new ApproveVendorRequestCommandHandler(
            h.Db,
            new VendorRequestRepository(h.Db),
            new FakeIdentityService("buyer-1", "appr-1", "appr-2", "final"),
            new FakeCurrentUser("appr-1"),
            new EmailOutbox(h.Db, clock),
            config,
            clock,
            new EmailActionTokenService(config));

        var sw = Stopwatch.StartNew();
        var dto = await handler.Handle(new ApproveVendorRequestCommand(request.Id, "approved"), default);
        sw.Stop();

        // "Tens of milliseconds." The ceiling is generous so a cold JIT or a loaded machine cannot
        // flake it — the claim being defended is that the handler no longer waits on SMTP at all,
        // and a relay that never answers would previously have pinned it for minutes.
        Assert.True(sw.Elapsed < TimeSpan.FromSeconds(2),
            $"Approve took {sw.ElapsedMilliseconds} ms against a dead relay — it is still sending inline.");

        Assert.Equal(request.Id, dto.Id);

        // The decision committed...
        using var verify = h.NewContext();
        var saved = await verify.VendorRequests
            .Include(r => r.ApprovalSteps)
            .SingleAsync(r => r.Id == request.Id);
        Assert.Equal(ApprovalDecision.Approved, saved.ApprovalSteps.Single(s => s.ApproverUserId == "appr-1").Decision);

        // ...and the mail is queued, not sent — with the PDF deferred to the dispatcher (the row
        // carries the request id, not the rendered bytes).
        var queued = await verify.OutboxEmails.ToListAsync();
        Assert.Equal(2, queued.Count);                                    // buyer + next approver
        Assert.All(queued, m => Assert.Null(m.SentAt));
        Assert.All(queued, m => Assert.Equal(request.Id, m.AttachVendorRequestId));
        Assert.Contains(queued, m => m.ToEmail == "buyer-1@andritz.com");
        Assert.Contains(queued, m => m.ToEmail == "appr-2@andritz.com");
    }
}
