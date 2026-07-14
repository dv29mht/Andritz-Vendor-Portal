namespace AndritzVendorPortal.Domain.Entities;

/// <summary>
/// A transactional email queued for background delivery. Rows are written in the same
/// SaveChangesAsync — and therefore the same DB transaction — as the workflow state change
/// that triggered them, so a mail is queued if and only if the state change committed.
/// The OutboxEmailDispatcher drains them off the request thread.
/// </summary>
public class OutboxEmail
{
    public int Id { get; set; }

    public string ToEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string BodyHtml { get; set; } = string.Empty;

    /// <summary>
    /// When set, the dispatcher attaches that vendor request's PDF. The bytes are not stored
    /// here: the PDF is a synchronous CPU-bound QuestPDF render, so it is produced by the
    /// dispatcher — once per vendor request per drain, shared across every recipient — rather
    /// than on the request thread.
    /// </summary>
    public int? AttachVendorRequestId { get; set; }

    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Earliest time the dispatcher may attempt (next) delivery. Moved forward on each retry — and
    /// also by the claim a dispatcher takes before sending, which is what stops two overlapping
    /// worker processes from both delivering the same row. A claim that is never resolved (the
    /// process died mid-send) simply expires, and the row falls due again.
    /// </summary>
    public DateTime NextAttemptAt { get; set; }

    public DateTime? SentAt { get; set; }

    /// <summary>Incremented when a dispatcher claims the row, so a message that kills the process still burns an attempt.</summary>
    public int AttemptCount { get; set; }

    /// <summary>
    /// Set once the retry budget is exhausted. The row is never retried again, and is kept as the
    /// audit record of mail that never got through — longer than a delivered row, but not forever;
    /// the dispatcher's retention sweep bounds both.
    /// </summary>
    public bool IsAbandoned { get; set; }

    public string? LastError { get; set; }
}
