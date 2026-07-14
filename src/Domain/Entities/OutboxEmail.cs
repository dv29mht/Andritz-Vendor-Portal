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

    /// <summary>Earliest time the dispatcher may attempt (next) delivery. Moved forward on each retry.</summary>
    public DateTime NextAttemptAt { get; set; }

    public DateTime? SentAt { get; set; }
    public int AttemptCount { get; set; }

    /// <summary>Set once the retry budget is exhausted. The row is kept as an audit record and never retried again.</summary>
    public bool IsAbandoned { get; set; }

    public string? LastError { get; set; }
}
