using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Infrastructure.BackgroundServices;
using AndritzVendorPortal.Infrastructure.Persistence;
using AndritzVendorPortal.Infrastructure.Persistence.Repositories;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// The dispatcher's delivery guarantees, each pinned to the way it could otherwise be broken.
///
/// <para>The through-line: an outbox is only worth having if what it says about a message is true.
/// A row stamped SentAt must really have been sent, a row not stamped must really be retried, and
/// neither a graceful recycle (2–6× a day here), a transient SQL error, nor a second worker process
/// overlapping the first may turn one of those into a lie.</para>
/// </summary>
public class OutboxDispatcherTests
{
    private static readonly DateTime Now = new(2026, 7, 14, 9, 0, 0, DateTimeKind.Utc);

    private sealed class FixedClock(DateTime now) : IDateTimeProvider
    {
        public DateTime UtcNow { get; } = now;
    }

    /// <summary>A clock the test moves by hand, to make a slow batch's elapsed time observable.</summary>
    private sealed class AdvancingClock(DateTime start) : IDateTimeProvider
    {
        public DateTime UtcNow { get; private set; } = start;

        public void Advance(TimeSpan by) => UtcNow += by;
    }

    /// <summary>Records every delivery. <paramref name="onSend"/> runs once the send has "reached the relay".</summary>
    private sealed class RecordingEmailService(Func<Task>? onSend = null) : IEmailService
    {
        private readonly List<string> _sent = [];

        public IReadOnlyList<string> Sent { get { lock (_sent) return [.. _sent]; } }

        public async Task SendAsync(
            string to, string subject, string htmlBody,
            IReadOnlyList<EmailAttachment>? attachments = null, CancellationToken ct = default)
        {
            lock (_sent) _sent.Add(to);
            if (onSend is not null) await onSend();
        }
    }

    private sealed class FakePdfService(Func<VendorRequest, byte[]> render) : IVendorRequestPdfService
    {
        public int Renders { get; private set; }

        public byte[] Generate(VendorRequest request)
        {
            Renders++;
            return render(request);
        }
    }

    /// <summary>A context whose Nth SaveChangesAsync fails the way a deadlock or a dropped connection would.</summary>
    private sealed class FailOnNthSaveContext(DbContextOptions<ApplicationDbContext> options, int failOn)
        : TestDb.SqliteApplicationDbContext(options)
    {
        private int _saves;

        public override Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            if (++_saves == failOn)
                throw new DbUpdateException("Simulated transient database failure.");
            return base.SaveChangesAsync(ct);
        }
    }

    private static EmailSettings Settings() => new()
    {
        Host = "127.0.0.1",
        TimeoutSeconds = 15,
        OutboxBatchSize = 20,
        OutboxMaxAttempts = 6,
        OutboxClaimLeaseSeconds = 120,
        OutboxSentRetentionDays = 30,
        OutboxAbandonedRetentionDays = 90,
    };

    private static OutboxEmailDispatcher Dispatcher(
        TestDb h,
        IEmailService email,
        IDateTimeProvider clock,
        EmailSettings? settings = null,
        IVendorRequestPdfService? pdf = null,
        Func<DbContextOptions<ApplicationDbContext>, ApplicationDbContext>? contextFactory = null)
    {
        var services = new ServiceCollection();
        // A scope per drain, each with its own context and connection — as in production, and what
        // lets two dispatchers here genuinely race rather than share a change tracker.
        services.AddScoped(_ => h.NewContext(contextFactory));
        services.AddScoped<IVendorRequestRepository>(sp =>
            new VendorRequestRepository(sp.GetRequiredService<ApplicationDbContext>()));
        services.AddSingleton(email);
        services.AddSingleton(clock);
        services.AddSingleton(pdf ?? new FakePdfService(_ => [1, 2, 3]));

        return new OutboxEmailDispatcher(
            services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(),
            Options.Create(settings ?? Settings()),
            NullLogger<OutboxEmailDispatcher>.Instance);
    }

    private static async Task QueueAsync(TestDb h, int count, int? attachVendorRequestId = null)
    {
        for (var i = 0; i < count; i++)
        {
            h.Db.OutboxEmails.Add(new OutboxEmail
            {
                ToEmail = $"user{i}@andritz.com",
                Subject = $"Approval required ({i})",
                BodyHtml = "<p>Please review</p>",
                AttachVendorRequestId = attachVendorRequestId,
                CreatedAt = Now,
                NextAttemptAt = Now,   // due immediately
            });
        }
        await h.Db.SaveChangesAsync();
    }

    private static async Task<List<OutboxEmail>> RowsAsync(TestDb h)
    {
        using var verify = h.NewContext();
        return await verify.OutboxEmails.OrderBy(m => m.Id).ToListAsync();
    }

    // ── A1: what was delivered stays delivered ──────────────────────────────────────────────────

    [Fact]
    public async Task A_drain_cancelled_partway_keeps_the_SentAt_of_what_it_already_sent()
    {
        // The recycle case. SentAt used to be set in memory and flushed by a single SaveChangesAsync
        // *after* the send loop — which took the stopping token and which every early exit path
        // skipped. So a graceful shutdown mid-batch threw away the record of everything the relay had
        // already accepted, and the next boot sent the lot again.
        using var h = new TestDb();
        await QueueAsync(h, count: 3);

        using var cts = new CancellationTokenSource();
        RecordingEmailService email = null!;
        email = new RecordingEmailService(() =>
        {
            // The host asks the dispatcher to stop, the instant the first message is away.
            if (email.Sent.Count == 1) cts.Cancel();
            return Task.CompletedTask;
        });

        var dispatcher = Dispatcher(h, email, new FixedClock(Now));

        await dispatcher.DrainAsync(cts.Token);

        Assert.Single(email.Sent);
        var afterShutdown = await RowsAsync(h);
        Assert.NotNull(afterShutdown[0].SentAt);          // durable despite the cancellation
        Assert.Null(afterShutdown[1].SentAt);
        Assert.Null(afterShutdown[2].SentAt);

        // The next boot picks up only what is genuinely still owed.
        await Dispatcher(h, email, new FixedClock(Now)).DrainAsync(default);

        Assert.Equal(3, email.Sent.Count);
        Assert.Equal(3, email.Sent.Distinct().Count());   // nothing delivered twice
        Assert.All(await RowsAsync(h), m => Assert.NotNull(m.SentAt));
    }

    [Fact]
    public async Task A_drain_whose_save_fails_does_not_re_send_the_batch_on_the_next_tick()
    {
        // The transient-SQL case. A failing save used to be caught by ExecuteAsync's outer handler,
        // which logged and let the next 5-second tick re-select the whole batch — re-sending every
        // message in it, and looping until the database recovered.
        using var h = new TestDb();
        await QueueAsync(h, count: 3);

        var email = new RecordingEmailService();
        var clock = new FixedClock(Now);

        // Message 0 saves; message 1 is sent and then its save dies under it.
        var failing = Dispatcher(h, email, clock,
            contextFactory: o => new FailOnNthSaveContext(o, failOn: 2));

        Assert.NotNull(await Record.ExceptionAsync(() => failing.DrainAsync(default)));
        Assert.Equal(2, email.Sent.Count);

        await Dispatcher(h, email, clock).DrainAsync(default);

        // Message 1 really was delivered, so it must not go out again. Its claim is what protects it:
        // the claim committed before the send, and it holds the row past the next tick — the message
        // is retried when the lease expires (if the relay never took it) rather than immediately.
        Assert.Equal(3, email.Sent.Count);
        Assert.Equal(3, email.Sent.Distinct().Count());

        var rows = await RowsAsync(h);
        Assert.NotNull(rows[0].SentAt);
        Assert.Null(rows[1].SentAt);                                   // the save that lost it
        Assert.Equal(Now.AddSeconds(120), rows[1].NextAttemptAt);      // held by its lease, not due
        Assert.Equal(1, rows[1].AttemptCount);
        Assert.NotNull(rows[2].SentAt);
    }

    // ── A2: two live dispatchers ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Two_concurrent_drains_deliver_each_message_exactly_once()
    {
        // IIS recycles with disallowOverlappingRotation=false, so the outgoing and incoming workers
        // overlap on every recycle — each with its own dispatcher. Both select the same due rows (the
        // SELECT takes no lock), and before the claim both would send them.
        using var h = new TestDb();
        await QueueAsync(h, count: 5);

        // A send slow enough that the two drains are genuinely inside the batch together.
        var email = new RecordingEmailService(() => Task.Delay(20));
        var clock = new FixedClock(Now);

        await Task.WhenAll(
            Dispatcher(h, email, clock).DrainAsync(default),
            Dispatcher(h, email, clock).DrainAsync(default));

        Assert.Equal(5, email.Sent.Count);
        Assert.Equal(5, email.Sent.Distinct().Count());

        var rows = await RowsAsync(h);
        Assert.All(rows, m => Assert.NotNull(m.SentAt));
        Assert.All(rows, m => Assert.Equal(1, m.AttemptCount));   // claimed once, by one of them
    }

    [Fact]
    public async Task A_batch_that_outlasts_the_lease_is_still_not_re_sent_by_the_other_dispatcher()
    {
        // A batch is sent one message at a time and each send can burn its full timeout against a
        // stalled relay, so a full batch easily outlasts the 120s lease. Every claim must therefore be
        // dated from the moment that row is claimed. Dating them all from the top of the drain hands
        // the later messages a lease that has already expired: they fall due again while this
        // dispatcher is still sending them, and the overlapping worker delivers them a second time —
        // during an outage, which is exactly when the claim has to hold.
        using var h = new TestDb();
        await QueueAsync(h, count: 4);

        var clock = new AdvancingClock(Now);
        RecordingEmailService email = null!;
        OutboxEmailDispatcher other = null!;

        email = new RecordingEmailService(async () =>
        {
            clock.Advance(TimeSpan.FromSeconds(60));   // a slow relay eats the lease

            // The third message is now in flight: claimed, sent, not yet stamped. The other worker
            // drains while it is in that window.
            if (email.Sent.Count == 3) await other.DrainAsync(default);
        });

        var main = Dispatcher(h, email, clock);
        other = Dispatcher(h, email, clock);

        await main.DrainAsync(default);

        Assert.Equal(4, email.Sent.Count);
        Assert.Equal(4, email.Sent.Distinct().Count());
        Assert.All(await RowsAsync(h), m => Assert.NotNull(m.SentAt));
    }

    // ── A5: a missing PDF fails the message, it does not degrade it ─────────────────────────────

    [Fact]
    public async Task A_pdf_render_failure_leaves_the_message_unsent_and_retryable()
    {
        // The render used to be wrapped in a catch-all that logged and returned null — and the caller
        // then sent the mail anyway and stamped SentAt. One transient QuestPDF fault meant every
        // recipient got an "approval required" email permanently missing the document they were being
        // asked to review, with no retry and one log line to show for it.
        using var h = new TestDb();

        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
        };
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();
        await QueueAsync(h, count: 1, attachVendorRequestId: request.Id);

        var email = new RecordingEmailService();
        var pdf = new FakePdfService(_ => throw new InvalidOperationException("QuestPDF blew up"));

        await Dispatcher(h, email, new FixedClock(Now), pdf: pdf).DrainAsync(default);

        Assert.Empty(email.Sent);                                  // not sent without its document

        var row = Assert.Single(await RowsAsync(h));
        Assert.Null(row.SentAt);
        Assert.False(row.IsAbandoned);
        Assert.Equal(1, row.AttemptCount);
        Assert.Equal(Now.AddSeconds(30), row.NextAttemptAt);       // first backoff — retryable
        Assert.Contains("QuestPDF blew up", row.LastError);
    }

    [Fact]
    public async Task A_request_deleted_before_its_mail_went_out_still_sends_without_the_pdf()
    {
        // The one benign reason to send with no attachment: the request is gone, so no retry will
        // ever produce a document. Kept deliberately distinct from a render failure.
        using var h = new TestDb();
        await QueueAsync(h, count: 1, attachVendorRequestId: 999);

        var email = new RecordingEmailService();
        var pdf = new FakePdfService(_ => throw new InvalidOperationException("must not be reached"));

        await Dispatcher(h, email, new FixedClock(Now), pdf: pdf).DrainAsync(default);

        Assert.Single(email.Sent);
        Assert.Equal(0, pdf.Renders);
        Assert.NotNull(Assert.Single(await RowsAsync(h)).SentAt);
    }

    [Fact]
    public async Task One_pdf_is_rendered_per_request_per_drain_however_many_recipients_it_has()
    {
        using var h = new TestDb();

        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
        };
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();
        await QueueAsync(h, count: 4, attachVendorRequestId: request.Id);

        var pdf = new FakePdfService(_ => [1, 2, 3]);
        var email = new RecordingEmailService();

        await Dispatcher(h, email, new FixedClock(Now), pdf: pdf).DrainAsync(default);

        Assert.Equal(4, email.Sent.Count);
        Assert.Equal(1, pdf.Renders);   // the CPU-bound render is not repeated per recipient
    }

    // ── A6: a send that did not happen is never recorded as one ─────────────────────────────────

    [Fact]
    public async Task A_blank_smtp_host_does_not_mark_the_message_as_sent()
    {
        using var h = new TestDb();
        await QueueAsync(h, count: 1);

        // The real transport, with no relay configured — the path that used to log "skipping" and
        // return normally, leaving the dispatcher to stamp SentAt on a mail that never existed.
        var email = new MailKitEmailService(
            Options.Create(new EmailSettings { Host = string.Empty }),
            NullLogger<MailKitEmailService>.Instance);

        await Dispatcher(h, email, new FixedClock(Now)).DrainAsync(default);

        var row = Assert.Single(await RowsAsync(h));
        Assert.Null(row.SentAt);
        Assert.Equal(1, row.AttemptCount);
        Assert.Contains("Host", row.LastError);
    }

    // ── A8: the table does not grow forever ─────────────────────────────────────────────────────

    [Fact]
    public async Task The_retention_sweep_deletes_sent_rows_past_the_window_and_keeps_everything_else()
    {
        using var h = new TestDb();

        OutboxEmail Row(string to, DateTime createdAt, DateTime? sentAt = null, bool abandoned = false) => new()
        {
            ToEmail = to,
            Subject = to,
            BodyHtml = "<p>body</p>",
            CreatedAt = createdAt,
            NextAttemptAt = createdAt,
            SentAt = sentAt,
            IsAbandoned = abandoned,
        };

        h.Db.OutboxEmails.AddRange(
            Row("old-sent@andritz.com", Now.AddDays(-40), sentAt: Now.AddDays(-40)),          // pruned (>30d)
            Row("recent-sent@andritz.com", Now.AddDays(-10), sentAt: Now.AddDays(-10)),       // kept
            Row("old-abandoned@andritz.com", Now.AddDays(-100), abandoned: true),             // pruned (>90d)
            Row("recent-abandoned@andritz.com", Now.AddDays(-40), abandoned: true),           // kept — audit trail
            Row("still-pending@andritz.com", Now.AddDays(-200)));                             // kept — still owed
        await h.Db.SaveChangesAsync();

        var pruned = await Dispatcher(h, new RecordingEmailService(), new FixedClock(Now)).SweepAsync(default);

        Assert.Equal(2, pruned);
        Assert.Equal(
            new[] { "recent-abandoned@andritz.com", "recent-sent@andritz.com", "still-pending@andritz.com" },
            (await RowsAsync(h)).Select(m => m.ToEmail).Order());
    }
}
