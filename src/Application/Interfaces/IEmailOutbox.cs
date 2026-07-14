namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Queues a transactional email for background delivery.
///
/// <para><c>Enqueue</c> only stages the row on the DbContext — it is persisted by the caller's
/// own <c>SaveChangesAsync</c>. Call it <em>before</em> saving the state change it announces so
/// that mail and state commit (or roll back) as one transaction: an approval can never be
/// recorded without its notification queued, and a rolled-back approval can never send mail.</para>
///
/// <para>Nothing is sent on the request thread. The OutboxEmailDispatcher hosted service drains
/// the table, renders any PDF attachment, and talks to SMTP — so a stalled relay can no longer
/// hold an HTTP request (or a thread-pool thread) open.</para>
/// </summary>
public interface IEmailOutbox
{
    /// <param name="attachVendorRequestId">
    /// When non-null, the dispatcher attaches that vendor request's PDF, generating it once and
    /// reusing the bytes across every recipient of the same request in the drain.
    /// </param>
    void Enqueue(string to, string subject, string htmlBody, int? attachVendorRequestId = null);
}
