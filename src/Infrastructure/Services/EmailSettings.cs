namespace AndritzVendorPortal.Infrastructure.Services;

public class EmailSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 25;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// STARTTLS. Deliberately false for the internal Andritz relay on port 25 (see 45cc7eb) —
    /// it does not advertise STARTTLS and turning this on makes every send fail.
    /// </summary>
    public bool EnableSsl { get; set; } = false;

    public string FromEmail { get; set; } = "noreply@andritz.com";
    public string FromName { get; set; } = "Andritz Supplier Connect";

    /// <summary>Hard ceiling on a single SMTP conversation. A stalled relay must never outlast this.</summary>
    public int TimeoutSeconds { get; set; } = 15;

    /// <summary>How often the outbox dispatcher looks for due mail.</summary>
    public int OutboxPollSeconds { get; set; } = 5;

    /// <summary>Rows drained per dispatcher tick.</summary>
    public int OutboxBatchSize { get; set; } = 20;

    /// <summary>Delivery attempts before a message is abandoned and logged as a permanent failure.</summary>
    public int OutboxMaxAttempts { get; set; } = 6;

    /// <summary>
    /// How long a dispatcher's claim on a row holds off every other dispatcher. Must comfortably
    /// exceed one send (TimeoutSeconds plus a PDF render); the dispatcher enforces that floor.
    /// It is also the worst-case delay before a row claimed by a process that then died becomes
    /// due again, so it should not be large.
    /// </summary>
    public int OutboxClaimLeaseSeconds { get; set; } = 120;

    /// <summary>Delivered rows are pruned once they are older than this. They carry the full rendered HTML body.</summary>
    public int OutboxSentRetentionDays { get; set; } = 30;

    /// <summary>
    /// Abandoned rows are the audit record of mail that never got through, so they are kept longer
    /// than delivered ones — but still bounded.
    /// </summary>
    public int OutboxAbandonedRetentionDays { get; set; } = 90;

    /// <summary>How often the dispatcher runs the retention sweep.</summary>
    public int OutboxSweepMinutes { get; set; } = 60;
}
