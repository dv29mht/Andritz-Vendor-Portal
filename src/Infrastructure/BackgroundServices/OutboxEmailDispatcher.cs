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
/// process recycles this app takes 2–6× a day. Delivery is at-least-once — a recycle mid-send can
/// replay a message the relay already accepted — which for notification mail is the right trade
/// against losing it.</para>
///
/// <para>Assumes a single worker process (IIS in-process, no web garden). A second process would
/// double-send in-flight rows; if that ever changes, claim rows with an UPDATE ... OUTPUT before
/// sending instead of relying on the sequential drain below.</para>
/// </summary>
public class OutboxEmailDispatcher(
    IServiceScopeFactory scopeFactory,
    IOptions<EmailSettings> options,
    ILogger<OutboxEmailDispatcher> logger) : BackgroundService
{
    private readonly EmailSettings _cfg = options.Value;

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

    private async Task DrainAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<ApplicationDbContext>();
        var email = sp.GetRequiredService<IEmailService>();
        var clock = sp.GetRequiredService<IDateTimeProvider>();

        var now = clock.UtcNow;
        var due = await db.OutboxEmails
            .Where(m => m.SentAt == null && !m.IsAbandoned && m.NextAttemptAt <= now)
            .OrderBy(m => m.Id)
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
            if (ct.IsCancellationRequested) return;

            try
            {
                var attachments = message.AttachVendorRequestId is { } requestId
                    ? await GetAttachmentsAsync(sp, pdfCache, requestId, ct)
                    : null;

                await email.SendAsync(message.ToEmail, message.Subject, message.BodyHtml, attachments, ct);

                message.SentAt = clock.UtcNow;
                message.AttemptCount++;
                message.LastError = null;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Shutting down. Leave the row untouched — it stays due and the next boot picks it up.
                return;
            }
            catch (Exception ex)
            {
                RecordFailure(message, ex, clock.UtcNow);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private void RecordFailure(OutboxEmail message, Exception ex, DateTime now)
    {
        message.AttemptCount++;
        message.LastError = Truncate($"{ex.GetType().Name}: {ex.Message}", 2000);

        if (message.AttemptCount >= Math.Max(1, _cfg.OutboxMaxAttempts))
        {
            message.IsAbandoned = true;
            logger.LogError(ex,
                "[Outbox] PERMANENT FAILURE — giving up on mail {Id} to {To} after {Attempts} attempts: {Subject}",
                message.Id, message.ToEmail, message.AttemptCount, message.Subject);
            return;
        }

        var backoff = BackoffFor(message.AttemptCount);
        message.NextAttemptAt = now + backoff;
        logger.LogWarning(ex,
            "[Outbox] Attempt {Attempts} failed for mail {Id} to {To}; retrying in {Backoff}",
            message.AttemptCount, message.Id, message.ToEmail, backoff);
    }

    /// <summary>Exponential backoff: 30s, 2m, 8m, 32m, then capped at 1h.</summary>
    private static TimeSpan BackoffFor(int attemptCount)
    {
        var seconds = 30d * Math.Pow(4, attemptCount - 1);
        return TimeSpan.FromSeconds(Math.Min(seconds, TimeSpan.FromHours(1).TotalSeconds));
    }

    private async Task<IReadOnlyList<EmailAttachment>?> GetAttachmentsAsync(
        IServiceProvider sp,
        Dictionary<int, IReadOnlyList<EmailAttachment>?> cache,
        int vendorRequestId,
        CancellationToken ct)
    {
        if (cache.TryGetValue(vendorRequestId, out var cached)) return cached;

        IReadOnlyList<EmailAttachment>? attachments = null;
        try
        {
            var repo = sp.GetRequiredService<IVendorRequestRepository>();
            var request = await repo.GetByIdWithDetailsAsync(vendorRequestId, ct);
            if (request is null)
            {
                // The request was discarded between queueing and sending. Send the mail without
                // the attachment rather than dropping the notification entirely.
                logger.LogWarning("[Outbox] Vendor request {Id} no longer exists — sending without the PDF", vendorRequestId);
            }
            else
            {
                var pdf = sp.GetRequiredService<IVendorRequestPdfService>();
                var bytes = pdf.Generate(request);
                var safeName = string.Join("_", request.VendorName.Split(Path.GetInvalidFileNameChars()));
                if (string.IsNullOrWhiteSpace(safeName)) safeName = $"vendor-request-{request.Id}";
                attachments = new[] { new EmailAttachment($"VendorRequest_{request.Id}_{safeName}.pdf", bytes) };
            }
        }
        catch (Exception ex)
        {
            // A PDF that won't render must not block the notification it was attached to.
            logger.LogError(ex, "[Outbox] Failed to render the PDF for vendor request {Id} — sending without it", vendorRequestId);
        }

        cache[vendorRequestId] = attachments;
        return attachments;
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max];
}
