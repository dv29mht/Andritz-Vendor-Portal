namespace AndritzVendorPortal.Domain.Entities;

/// <summary>
/// A persisted, per-recipient notification. One row is written per recipient per
/// workflow action (submit, approve, reject, complete, resubmit, buyer-update), so
/// the full history of a form is retained — a request submitted, rejected, then
/// resubmitted yields a notification for each event rather than collapsing to the
/// latest state. Read state is per row (per recipient).
/// </summary>
public class Notification
{
    public int Id { get; set; }

    /// <summary>ASP.NET Identity user id of the recipient.</summary>
    public string RecipientUserId { get; set; } = string.Empty;

    /// <summary>The vendor request this notification is about (null for non-request events).</summary>
    public int? VendorRequestId { get; set; }

    /// <summary>Event category, e.g. Submitted/Resubmitted/StepApproved/AssignedForReview/Rejected/Completed/BuyerUpdated.</summary>
    public string Type { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}
