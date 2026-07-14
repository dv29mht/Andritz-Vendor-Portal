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
}
