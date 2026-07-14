using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AndritzVendorPortal.Tests;

public class EmailOutboxTests
{
    private sealed class FixedClock(DateTime now) : IDateTimeProvider
    {
        public DateTime UtcNow { get; } = now;
    }

    private static readonly DateTime Now = new(2026, 7, 14, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Queued_mail_commits_with_the_state_change_it_announces()
    {
        using var h = new TestDb();
        var outbox = new EmailOutbox(h.Db, new FixedClock(Now));

        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
        };
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();

        // The handler shape: mutate, queue, save once.
        request.Status = VendorRequestStatus.PendingFinalApproval;
        outbox.Enqueue("approver@andritz.com", "Approval required", "<p>Please review</p>", request.Id);
        await h.Db.SaveChangesAsync();

        using var verify = h.NewContext();
        var queued = Assert.Single(await verify.OutboxEmails.ToListAsync());

        Assert.Equal("approver@andritz.com", queued.ToEmail);
        Assert.Equal(request.Id, queued.AttachVendorRequestId);
        Assert.Null(queued.SentAt);
        Assert.Equal(0, queued.AttemptCount);
        Assert.Equal(Now, queued.NextAttemptAt);   // due immediately
        Assert.Equal(
            VendorRequestStatus.PendingFinalApproval,
            (await verify.VendorRequests.SingleAsync(r => r.Id == request.Id)).Status);
    }

    [Fact]
    public async Task A_rolled_back_state_change_takes_its_queued_mail_with_it()
    {
        // This is the point of writing the mail in the caller's transaction rather than sending it
        // after the fact: a vendor-code collision that rolls the completion back must not leave a
        // "your vendor is approved" email behind.
        using var h = new TestDb();
        var outbox = new EmailOutbox(h.Db, new FixedClock(Now));

        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingFinalApproval,
            CreatedByUserId = "buyer-1",
        };
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();

        await using (var tx = await h.Db.BeginTransactionAsync(default))
        {
            request.Status = VendorRequestStatus.Completed;
            request.VendorCode = "12345";
            outbox.Enqueue("buyer@andritz.com", "Vendor approved", "<p>Done</p>", request.Id);
            await h.Db.SaveChangesAsync();
            // No commit — the transaction is disposed and rolls back, as it would on a conflict.
        }

        using var verify = h.NewContext();
        Assert.Empty(await verify.OutboxEmails.ToListAsync());
        Assert.Equal(
            VendorRequestStatus.PendingFinalApproval,
            (await verify.VendorRequests.SingleAsync(r => r.Id == request.Id)).Status);
    }

    [Fact]
    public void An_email_with_no_recipient_is_not_queued()
    {
        using var h = new TestDb();
        var outbox = new EmailOutbox(h.Db, new FixedClock(Now));

        outbox.Enqueue("", "subject", "<p>body</p>");

        Assert.Empty(h.Db.ChangeTracker.Entries<OutboxEmail>());
    }
}
