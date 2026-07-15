using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Infrastructure.Persistence;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace AndritzVendorPortal.Infrastructure.BackgroundServices;

/// <summary>
/// Drains the OutboxEmails table off the request thread.
///
/// <para>This is the fix for the production incident: every notification email used to be awaited
/// inside the HTTP request, so a stalled SMTP relay held the request — and its thread-pool thread —
/// open for minutes. Approvals ran to 312 s (and twice to 441 s / 625 s), the thread pool starved,
/// and unrelated requests queued behind them for up to 34 minutes at only 5–30 req/min. Handlers now
/// commit an outbox row in the same transaction as the state change and return; nothing here can
/// slow them down.</para>
///
/// <para>Durability: because the row commits with the state change, an approval's mail survives the
/// process recycles this app takes 2–6× a day. Each message's outcome is then persisted on its own,
/// immediately after its send, with <see cref="CancellationToken.None"/> — a shutdown may stop the
/// drain, but it must never cancel the record of what was already delivered. Nothing is batched up
/// to a save at the end of the loop that a recycle could skip.</para>
///
/// <para>Concurrency: two dispatchers can be live at once. IIS recycles with
/// <c>disallowOverlappingRotation=false</c>, so on every recycle the outgoing and incoming workers
/// overlap, each with its own dispatcher. A row is therefore <em>claimed</em> before it is sent — a
/// conditional UPDATE that only matches while the row is still due — and only the process whose
/// UPDATE matched sends it.</para>
///
/// <para>Delivery is at-least-once. A claim that is never resolved (the process died mid-send) has
/// its row fall due again when the lease expires, because whether the relay took that message is
/// unknowable; for notification mail a rare duplicate beats a silent loss.</para>
/// </summary>
public class OutboxEmailDispatcher(
    IServiceScopeFactory scopeFactory,
    IOptions<EmailSettings> options,
    ILogger<OutboxEmailDispatcher> logger) : BackgroundService
{
    private readonly EmailSettings _cfg = options.Value;

    private int _ticksUntilSweep;   // 0 → sweep on the first cycle, then every SweepEveryTicks

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var poll = TimeSpan.FromSeconds(Math.Max(1, _cfg.OutboxPollSeconds));
        logger.LogInformation("[Outbox] Dispatcher started (poll {Poll}s, batch {Batch}, max {Attempts} attempts)",
            poll.TotalSeconds, _cfg.OutboxBatchSize, _cfg.OutboxMaxAttempts);

        using var timer = new PeriodicTimer(poll);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DrainAsync(stoppingToken);
                await SweepIfDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // A failure here is the outbox machinery itself (DB unreachable, etc.), not a
                // single bad message. Log and keep polling — never let the loop die.
                logger.LogError(ex, "[Outbox] Drain cycle failed; will retry on the next tick");
            }

            try { await timer.WaitForNextTickAsync(stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        logger.LogInformation("[Outbox] Dispatcher stopped");
    }

    internal async Task DrainAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<ApplicationDbContext>();
        var email = sp.GetRequiredService<IEmailService>();
        var clock = sp.GetRequiredService<IDateTimeProvider>();

        var now = clock.UtcNow;
        var due = await db.OutboxEmails
            .Where(m => m.SentAt == null && !m.IsAbandoned && m.NextAttemptAt <= now)
            // Ordered by (NextAttemptAt, Id) — the exact key of the filtered index, so the range
            // seek returns rows already in order and SQL Server applies TOP without a sort. Ordering
            // by Id alone forced it to sort the whole due set first, which is free while the relay is
            // healthy and the set is a handful of rows, and is a re-sort of a backlog running into
            // the thousands, every 5 seconds, during an outage. It is also the more correct drain
            // order: oldest-due first.
            .OrderBy(m => m.NextAttemptAt).ThenBy(m => m.Id)
            .Take(Math.Max(1, _cfg.OutboxBatchSize))
            .ToListAsync(ct);

        if (due.Count == 0) return;

        // One PDF per vendor request per drain, not one per recipient. Generating it is a
        // synchronous, CPU-bound QuestPDF render; the old code re-ran it inside the per-recipient
        // send loop of ApproveVendorRequestCommand and BuyerUpdateCompletedCommand, on the request
        // thread. Here it runs off-thread and the bytes are reused across every message in the
        // batch that attaches the same request.
        var pdfCache = new Dictionary<int, IReadOnlyList<EmailAttachment>?>();

        foreach (var message in due)
        {
            // Everything before this point is already persisted, so stopping here loses nothing.
            if (ct.IsCancellationRequested) return;

            // What the claim will make this row's attempt count. Read it from here and not from the
            // entity, whose AttemptCount is deliberately left stale — see TryClaimAsync.
            var attempt = message.AttemptCount + 1;

            // The lease runs from the moment this row is claimed, not from the top of the drain: a
            // batch is sent one message at a time, and against a stalled relay each send can burn its
            // full timeout, so a whole batch can easily outlast the lease. Dating every claim from the
            // drain's start would hand the last messages in the batch a lease that had already expired
            // — they would fall due again while this dispatcher was still sending them, and the other
            // one would pick them up and deliver them a second time. Precisely during an outage, which
            // is exactly when the claim has to hold.
            //
            // dueAsOf stays the drain's own snapshot: it only has to assert that the row was still due
            // when we selected it, and anyone who claimed it since has pushed NextAttemptAt past it.
            var leaseUntil = clock.UtcNow + LeaseDuration();

            // Claim it, or leave it to whoever did.
            if (!await TryClaimAsync(db, message, now, leaseUntil, ct)) continue;

            try
            {
                var attachments = message.AttachVendorRequestId is { } requestId
                    ? await GetAttachmentsAsync(sp, pdfCache, requestId, ct)
                    : null;

                await email.SendAsync(message.ToEmail, message.Subject, message.BodyHtml, attachments, ct);

                message.SentAt = clock.UtcNow;
                message.LastError = null;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Shutting down mid-send. The claim is committed, so the row is held — not lost:
                // it falls due again when the lease expires and the next boot delivers it.
                return;
            }
            catch (Exception ex)
            {
                RecordFailure(message, attempt, ex, clock.UtcNow);
            }

            // Persist this message's outcome before moving to the next, and persist it with
            // CancellationToken.None: a shutdown must not be able to cancel the record of a delivery
            // that already happened. A single save after the loop — taking the stopping token — was
            // skipped by every exit path, so a graceful recycle mid-batch (2–6× a day here) dropped
            // the SentAt of every message already delivered in that batch and re-sent them on the
            // next boot.
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    /// <summary>
    /// Takes exclusive ownership of a row for the length of the lease, and reports whether we got it.
    ///
    /// <para>The claim advances NextAttemptAt rather than adding a ClaimedAt/ClaimedBy column: the
    /// row's due-ness is the only thing a claim has to suppress, the filtered index already keys on
    /// exactly that column, and it needs no schema change on a live production database. The UPDATE
    /// re-checks the due predicate under the row lock, so of two dispatchers racing the same row
    /// exactly one sees a rowcount of 1 — and a claim that is never resolved expires on its own,
    /// which is what keeps a crashed process from parking mail in permanent limbo.</para>
    ///
    /// <para>The attempt is counted here rather than after the send, so a message that kills the
    /// process still burns an attempt and cannot loop forever.</para>
    ///
    /// <para>This writes straight to the row and does NOT touch the tracked copy the caller holds,
    /// whose AttemptCount and NextAttemptAt are therefore stale from here on. That is deliberate:
    /// SaveChanges writes exactly those properties whose value it has seen change, so leaving these
    /// two alone is what stops the save that records the send's outcome from overwriting what the
    /// claim just wrote. The caller reads the attempt number from its own local, and only ever
    /// re-writes NextAttemptAt when it genuinely means to — to schedule a retry.</para>
    /// </summary>
    internal static async Task<bool> TryClaimAsync(
        ApplicationDbContext db, OutboxEmail message, DateTime dueAsOf, DateTime leaseUntil, CancellationToken ct)
    {
        var claimed = await db.OutboxEmails
            .Where(m => m.Id == message.Id
                        && m.SentAt == null
                        && !m.IsAbandoned
                        && m.NextAttemptAt <= dueAsOf)
            .ExecuteUpdateAsync(s => s
                .SetProperty(m => m.NextAttemptAt, leaseUntil)
                .SetProperty(m => m.AttemptCount, m => m.AttemptCount + 1), ct);

        return claimed == 1;
    }

    /// <summary>
    /// The claim's lifetime. Floored well above one send — a message still in flight must never have
    /// its lease expire under it and be picked up by the other dispatcher.
    /// </summary>
    private TimeSpan LeaseDuration()
    {
        var floor = TimeSpan.FromSeconds(Math.Max(1, _cfg.TimeoutSeconds) * 4);
        var configured = TimeSpan.FromSeconds(Math.Max(1, _cfg.OutboxClaimLeaseSeconds));
        return configured > floor ? configured : floor;
    }

    /// <param name="attempt">The count the claim wrote. The entity's own AttemptCount is stale — see TryClaimAsync.</param>
    private void RecordFailure(OutboxEmail message, int attempt, Exception ex, DateTime now)
    {
        message.LastError = Truncate($"{ex.GetType().Name}: {ex.Message}", 2000);

        if (attempt >= Math.Max(1, _cfg.OutboxMaxAttempts))
        {
            message.IsAbandoned = true;
            logger.LogError(ex,
                "[Outbox] PERMANENT FAILURE — giving up on mail {Id} to {To} after {Attempts} attempts: {Subject}",
                message.Id, message.ToEmail, attempt, message.Subject);
            return;
        }

        var backoff = BackoffFor(attempt);
        message.NextAttemptAt = now + backoff;   // supersedes the lease — we are done with the row
        logger.LogWarning(ex,
            "[Outbox] Attempt {Attempts} failed for mail {Id} to {To}; retrying in {Backoff}",
            attempt, message.Id, message.ToEmail, backoff);
    }

    /// <summary>Exponential backoff: 30s, 2m, 8m, 32m, then capped at 1h.</summary>
    private static TimeSpan BackoffFor(int attemptCount)
    {
        var seconds = 30d * Math.Pow(4, attemptCount - 1);
        return TimeSpan.FromSeconds(Math.Min(seconds, TimeSpan.FromHours(1).TotalSeconds));
    }

    /// <summary>
    /// The vendor request's PDF, rendered at most once per drain. A render failure is deliberately
    /// NOT caught: it fails the message, and the existing retry/backoff picks it up. Swallowing it —
    /// as the old code did, logging and returning null — sent every recipient an "approval required"
    /// email permanently missing the document they were being asked to review, stamped as a
    /// successful delivery, with no retry. Only a successful render is cached, so a transient fault
    /// costs at most a re-render and can never be reused as if it were a legitimate no-attachment.
    /// </summary>
    private async Task<IReadOnlyList<EmailAttachment>?> GetAttachmentsAsync(
        IServiceProvider sp,
        Dictionary<int, IReadOnlyList<EmailAttachment>?> cache,
        int vendorRequestId,
        CancellationToken ct)
    {
        if (cache.TryGetValue(vendorRequestId, out var cached)) return cached;

        var repo = sp.GetRequiredService<IVendorRequestRepository>();
        var request = await repo.GetByIdWithDetailsAsync(vendorRequestId, ct);

        if (request is null)
        {
            // The request was discarded between queueing and sending. Send the notification without
            // the attachment: there is nothing to render, and no retry will ever change that. This is
            // the one benign reason to send an approval mail with no document attached.
            logger.LogWarning("[Outbox] Vendor request {Id} no longer exists — sending without the PDF", vendorRequestId);
            return cache[vendorRequestId] = null;
        }

        var pdf = sp.GetRequiredService<IVendorRequestPdfService>();
        var bytes = pdf.Generate(request);

        var safeName = string.Join("_", request.VendorName.Split(Path.GetInvalidFileNameChars()));
        if (string.IsNullOrWhiteSpace(safeName)) safeName = $"vendor-request-{request.Id}";

        return cache[vendorRequestId] = new[] { new EmailAttachment($"VendorRequest_{request.Id}_{safeName}.pdf", bytes) };
    }

    private async Task SweepIfDueAsync(CancellationToken ct)
    {
        if (_ticksUntilSweep > 0)
        {
            _ticksUntilSweep--;
            return;
        }

        var poll = Math.Max(1, _cfg.OutboxPollSeconds);
        var every = Math.Max(1, _cfg.OutboxSweepMinutes) * 60 / poll;
        _ticksUntilSweep = Math.Max(1, every);

        await SweepAsync(ct);
    }

    /// <summary>
    /// Prunes the outbox. Every delivered row keeps its full rendered HTML body forever otherwise,
    /// and at 5–30 req/min this table would quietly become the largest object in the database and
    /// inflate every backup and restore. Abandoned rows are the audit trail for mail that never got
    /// through, so they are kept longer — but they are bounded too.
    /// </summary>
    /// <returns>How many rows were deleted.</returns>
    internal async Task<int> SweepAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clock = scope.ServiceProvider.GetRequiredService<IDateTimeProvider>();

        var now = clock.UtcNow;
        var sentBefore = now - TimeSpan.FromDays(Math.Max(1, _cfg.OutboxSentRetentionDays));
        var abandonedBefore = now - TimeSpan.FromDays(Math.Max(1, _cfg.OutboxAbandonedRetentionDays));

        var sent = await db.OutboxEmails
            .Where(m => m.SentAt != null && m.SentAt < sentBefore)
            .ExecuteDeleteAsync(ct);

        var abandoned = await db.OutboxEmails
            .Where(m => m.IsAbandoned && m.CreatedAt < abandonedBefore)
            .ExecuteDeleteAsync(ct);

        if (sent + abandoned > 0)
            logger.LogInformation(
                "[Outbox] Retention sweep pruned {Sent} sent (delivered before {SentBefore:yyyy-MM-dd}) and " +
                "{Abandoned} abandoned (queued before {AbandonedBefore:yyyy-MM-dd}) rows",
                sent, sentBefore, abandoned, abandonedBefore);

        return sent + abandoned;
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
