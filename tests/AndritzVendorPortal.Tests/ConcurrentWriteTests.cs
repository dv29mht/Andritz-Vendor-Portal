using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// The concurrency half of the incident: "Two SaveDraftCommands 6 s apart on request 26 raced and
/// hit Cannot insert duplicate key row in object 'dbo.ApprovalSteps' with unique index
/// 'IX_ApprovalSteps_VendorRequestId_StepOrder' → HTTP 500", and "Two approvals of the same request
/// 35 s apart both hung and failed."
///
/// <para>Each test stages the race as it actually happened: both writers read the request, then both
/// write. Worth knowing: the old delete-then-reinsert rewrite is <em>not</em> reproducible
/// single-threaded — EF orders the DELETEs ahead of the INSERTs within one SaveChanges — which is
/// exactly why this only ever bit under load, once the stalled relay had users double-clicking.</para>
/// </summary>
public class ConcurrentWriteTests
{
    private static async Task<int> SeedDraftAsync(TestDb h, params string[] approvers)
    {
        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.Draft,
            CreatedByUserId = "buyer-1",
        };

        var order = 1;
        foreach (var approver in approvers)
        {
            request.ApprovalSteps.Add(new ApprovalStep
            {
                ApproverUserId = approver,
                ApproverName = $"User {approver}",
                StepOrder = order++,
                IsFinalApproval = false,
            });
        }
        request.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId = "final",
            ApproverName = "Final Approver",
            StepOrder = order,
            IsFinalApproval = true,
        });

        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();
        return request.Id;
    }

    [Fact]
    public async Task Two_racing_chain_rewrites_never_produce_a_duplicate_key_violation()
    {
        using var h = new TestDb();
        var id = await SeedDraftAsync(h, "a", "b");

        // Both save-drafts read the request before either has written — the double-click.
        var ctx1 = h.NewContext();
        var ctx2 = h.NewContext();
        var r1 = await ctx1.VendorRequests.Include(r => r.ApprovalSteps).SingleAsync(r => r.Id == id);
        var r2 = await ctx2.VendorRequests.Include(r => r.ApprovalSteps).SingleAsync(r => r.Id == id);

        await ApprovalChainBuilder.RebuildIntermediateAsync(r1, ctx1, ["x", "y"], new FakeIdentityService("x", "y"), default);
        await ctx1.SaveChangesAsync();

        // The second writer now commits against a request the first already rewrote.
        var second = await Record.ExceptionAsync(async () =>
        {
            await ApprovalChainBuilder.RebuildIntermediateAsync(r2, ctx2, ["p", "q"], new FakeIdentityService("p", "q"), default);
            await ctx2.SaveChangesAsync();
        });

        // Losing the race is fine — the API maps a concurrency loss to 409. A duplicate-key
        // violation is not fine: that is the 500 this whole fix exists to remove.
        Assert.DoesNotContain("UNIQUE", second?.ToString() ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        if (second is not null) Assert.IsType<DbUpdateConcurrencyException>(second);

        // Either way the chain is left consistent: distinct contiguous orders, final approver last.
        using var verify = h.NewContext();
        var chain = await verify.ApprovalSteps.IgnoreQueryFilters()
            .Where(s => s.VendorRequestId == id).OrderBy(s => s.StepOrder).ToListAsync();

        Assert.Equal(chain.Count, chain.Select(s => s.StepOrder).Distinct().Count());
        Assert.Equal(Enumerable.Range(1, chain.Count), chain.Select(s => s.StepOrder));
        Assert.True(chain[^1].IsFinalApproval);
    }

    [Fact]
    public async Task Two_racing_approvals_of_the_same_step_let_exactly_one_through()
    {
        using var h = new TestDb();
        var id = await SeedDraftAsync(h, "a");

        var ctx1 = h.NewContext();
        var ctx2 = h.NewContext();
        var step1 = await ctx1.ApprovalSteps.IgnoreQueryFilters()
            .SingleAsync(s => s.VendorRequestId == id && s.ApproverUserId == "a");
        var step2 = await ctx2.ApprovalSteps.IgnoreQueryFilters()
            .SingleAsync(s => s.VendorRequestId == id && s.ApproverUserId == "a");

        // Both requests saw a Pending step; both record an approval.
        step1.Decision = ApprovalDecision.Approved;
        step1.DecidedAt = DateTime.UtcNow;
        await ctx1.SaveChangesAsync();

        step2.Decision = ApprovalDecision.Approved;
        step2.DecidedAt = DateTime.UtcNow;

        // ApprovalStep.Decision is a concurrency token, so the second UPDATE matches zero rows and
        // loses cleanly. GlobalExceptionMiddleware maps that to a 409, and EmailActionController
        // turns it into "Already acted" — which is what makes the emailed one-click GET idempotent
        // under a double-click or a mail-client link prefetch.
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => ctx2.SaveChangesAsync());

        using var verify = h.NewContext();
        var approved = await verify.ApprovalSteps.IgnoreQueryFilters()
            .Where(s => s.VendorRequestId == id && s.Decision == ApprovalDecision.Approved)
            .ToListAsync();
        Assert.Single(approved);
    }
}
