using AndritzVendorPortal.Application.Features.Users.Commands;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// Archiving or purging an approver has to release every step queued to them — including the steps
/// on requests that are themselves archived.
///
/// <para>ApprovalStep now mirrors VendorRequest's !IsArchived query filter (it is the required end of
/// that relationship, and without a matching filter EF warns that rows can be silently dropped). That
/// filter also silently narrowed these two commands, which query db.ApprovalSteps directly: a step on
/// an archived request stopped being visible to them, so it was never flagged. Restore the request
/// later and it holds a Pending step whose ApproverUserId no longer resolves — the stale-approver
/// state the commands' own ConflictException exists to prevent — and the request cannot advance.</para>
/// </summary>
public class UserLifecycleTests
{
    private static readonly DateTime Now = new(2026, 7, 14, 9, 0, 0, DateTimeKind.Utc);

    private sealed class FixedClock : IDateTimeProvider
    {
        public DateTime UtcNow => Now;
    }

    private sealed class NoopLoginSecurity : ILoginSecurityService
    {
        public Task<DateTime?> GetTokensValidSinceAsync(string userId, string role, CancellationToken ct = default) =>
            Task.FromResult<DateTime?>(null);
        public Task RevokeAllAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default) =>
            Task.CompletedTask;
        public Task RevokeAsync(string userId, string role, CancellationToken ct = default) => Task.CompletedTask;
    }

    /// <summary>
    /// An archived request, mid-chain: bob is the active approver and alice is queued behind him.
    /// Alice is therefore removable — she is not blocking anything — so her step must be flagged.
    /// </summary>
    private static async Task<int> SeedArchivedRequestAsync(TestDb h)
    {
        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
            IsArchived = true,
        };
        request.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId = "bob", ApproverName = "User bob", StepOrder = 1,
        });
        request.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId = "alice", ApproverName = "User alice", StepOrder = 2,
        });
        request.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId = "final", ApproverName = "Final Approver", StepOrder = 3, IsFinalApproval = true,
        });

        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();
        return request.Id;
    }

    private static async Task<ApprovalStep> AliceStepAsync(TestDb h, int requestId)
    {
        using var verify = h.NewContext();
        return await verify.ApprovalSteps
            .IgnoreQueryFilters()
            .SingleAsync(s => s.VendorRequestId == requestId && s.ApproverUserId == "alice");
    }

    [Fact]
    public async Task Archiving_an_approver_flags_their_pending_step_on_an_archived_request()
    {
        using var h = new TestDb();
        var requestId = await SeedArchivedRequestAsync(h);

        var handler = new ArchiveUserCommandHandler(
            new FakeIdentityService("alice", "bob", "final"),
            h.Db,
            new FixedClock(),
            new NoopLoginSecurity());

        await handler.Handle(new ArchiveUserCommand("alice"), default);

        var step = await AliceStepAsync(h, requestId);
        Assert.True(step.IsDeletedApprover);
        Assert.Contains("deleted by Admin", step.DeletedApproverNote);
    }

    [Fact]
    public async Task Purging_an_approver_flags_their_pending_step_on_an_archived_request()
    {
        // Worse than archive: a purged user's id can never resolve again, so a step missed here is
        // stranded permanently.
        using var h = new TestDb();
        var requestId = await SeedArchivedRequestAsync(h);

        var handler = new PurgeUserCommandHandler(
            new FakeIdentityService("alice", "bob", "final"),
            h.Db,
            new FixedClock(),
            new NoopLoginSecurity());

        await handler.Handle(new PurgeUserCommand("alice"), default);

        var step = await AliceStepAsync(h, requestId);
        Assert.True(step.IsDeletedApprover);
        Assert.Contains("permanently deleted by Admin", step.DeletedApproverNote);
    }
}
