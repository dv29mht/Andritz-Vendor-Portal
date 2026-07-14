using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// Stages outbox rows on the request's DbContext. Deliberately does NOT save: the caller's
/// SaveChangesAsync is what persists them, which is the whole point — the mail and the state
/// change it announces share one transaction.
/// </summary>
public class EmailOutbox(IApplicationDbContext db, IDateTimeProvider clock) : IEmailOutbox
{
    public void Enqueue(string to, string subject, string htmlBody, int? attachVendorRequestId = null)
    {
        if (string.IsNullOrWhiteSpace(to)) return;

        var now = clock.UtcNow;
        db.OutboxEmails.Add(new OutboxEmail
        {
            ToEmail = to,
            Subject = subject,
            BodyHtml = htmlBody,
            AttachVendorRequestId = attachVendorRequestId,
            CreatedAt = now,
            NextAttemptAt = now,   // eligible on the dispatcher's next tick
        });
    }
}
