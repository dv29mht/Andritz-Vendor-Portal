using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// Covers the approval-chain rewrite that produced the production 500s:
/// <c>Cannot insert duplicate key row in object 'dbo.ApprovalSteps' with unique index
/// 'IX_ApprovalSteps_VendorRequestId_StepOrder'</c>.
///
/// <para>Runs against SQLite with the real schema, so the unique index is genuinely enforced —
/// the EF in-memory provider ignores indexes and would pass even on the broken delete-then-reinsert.</para>
/// </summary>
public class ApprovalChainRewriteTests
{
    private const string Final = "final-approver";

    private static async Task<VendorRequest> SeedAsync(TestDb h, params string[] intermediateApprovers)
    {
        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.Draft,
            CreatedByUserId = "buyer-1",
        };

        var order = 1;
        foreach (var approver in intermediateApprovers)
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
            ApproverUserId = Final,
            ApproverName = "Final Approver",
            StepOrder = order,
            IsFinalApproval = true,
        });

        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();
        return request;
    }

    private static async Task<List<ApprovalStep>> ReloadChainAsync(TestDb h, int requestId) =>
        await h.Db.ApprovalSteps
            .IgnoreQueryFilters()
            .Where(s => s.VendorRequestId == requestId)
            .OrderBy(s => s.StepOrder)
            .ToListAsync();

    [Fact]
    public async Task Rewriting_a_chain_to_the_same_length_keeps_the_step_rows_and_renames_the_approvers()
    {
        using var h = new TestDb();
        var request = await SeedAsync(h, "a", "b");
        var originalStepIds = request.ApprovalSteps.Where(s => !s.IsFinalApproval).Select(s => s.Id).ToList();

        await ApprovalChainBuilder.RebuildIntermediateAsync(
            request, h.Db, ["c", "d"], new FakeIdentityService("c", "d"), default);
        await h.Db.SaveChangesAsync();

        var chain = await ReloadChainAsync(h, request.Id);

        Assert.Equal([1, 2, 3], chain.Select(s => s.StepOrder));
        Assert.Equal(["c", "d", Final], chain.Select(s => s.ApproverUserId));
        // Upsert, not delete-then-reinsert: the same two rows were reused.
        Assert.Equal(
            originalStepIds,
            chain.Where(s => !s.IsFinalApproval).Select(s => s.Id).ToList());
    }

    [Fact]
    public async Task Growing_a_chain_does_not_collide_with_the_final_approvers_step_order()
    {
        // The dangerous shape: the new third approver wants StepOrder 3, which the final approver
        // is holding right now. If the INSERT lands before the final approver's UPDATE, SQL rejects
        // it on the unique index.
        using var h = new TestDb();
        var request = await SeedAsync(h, "a", "b");

        await ApprovalChainBuilder.RebuildIntermediateAsync(
            request, h.Db, ["a", "b", "c"], new FakeIdentityService("a", "b", "c"), default);
        await h.Db.SaveChangesAsync();

        var chain = await ReloadChainAsync(h, request.Id);

        Assert.Equal([1, 2, 3, 4], chain.Select(s => s.StepOrder));
        Assert.Equal(["a", "b", "c", Final], chain.Select(s => s.ApproverUserId));
        Assert.True(chain[^1].IsFinalApproval);
    }

    [Fact]
    public async Task Shrinking_a_chain_drops_the_surplus_steps_and_pulls_the_final_approver_forward()
    {
        // The mirror-image hazard: the final approver moves down onto a StepOrder currently held by
        // a step that is being deleted in the same batch.
        using var h = new TestDb();
        var request = await SeedAsync(h, "a", "b", "c");

        await ApprovalChainBuilder.RebuildIntermediateAsync(
            request, h.Db, ["a"], new FakeIdentityService("a"), default);
        await h.Db.SaveChangesAsync();

        var chain = await ReloadChainAsync(h, request.Id);

        Assert.Equal([1, 2], chain.Select(s => s.StepOrder));
        Assert.Equal(["a", Final], chain.Select(s => s.ApproverUserId));
    }

    [Fact]
    public async Task Collapsing_a_chain_to_the_final_approver_only_leaves_a_single_step()
    {
        using var h = new TestDb();
        var request = await SeedAsync(h, "a", "b");

        await ApprovalChainBuilder.RebuildIntermediateAsync(
            request, h.Db, [], new FakeIdentityService(), default);
        await h.Db.SaveChangesAsync();

        var chain = await ReloadChainAsync(h, request.Id);

        var only = Assert.Single(chain);
        Assert.True(only.IsFinalApproval);
        Assert.Equal(1, only.StepOrder);
    }

    [Fact]
    public async Task Rewriting_a_chain_clears_any_decision_already_recorded_on_a_reused_step()
    {
        using var h = new TestDb();
        var request = await SeedAsync(h, "a", "b");
        var first = request.ApprovalSteps.First(s => s.StepOrder == 1);
        first.Decision = ApprovalDecision.Approved;
        first.Comment = "looks fine";
        first.DecidedAt = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        await h.Db.SaveChangesAsync();

        await ApprovalChainBuilder.RebuildIntermediateAsync(
            request, h.Db, ["c", "b"], new FakeIdentityService("b", "c"), default);
        await h.Db.SaveChangesAsync();

        var chain = await ReloadChainAsync(h, request.Id);
        var rewritten = chain.Single(s => s.StepOrder == 1);

        Assert.Equal("c", rewritten.ApproverUserId);
        Assert.Equal(ApprovalDecision.Pending, rewritten.Decision);
        Assert.Null(rewritten.Comment);
        Assert.Null(rewritten.DecidedAt);
    }

    [Fact]
    public async Task No_step_is_ever_left_at_a_parked_negative_step_order()
    {
        // The renumbering shuffle parks rows at negative StepOrders between its two flushes. Those
        // are an implementation detail and must never survive the rewrite.
        using var h = new TestDb();
        var request = await SeedAsync(h, "a", "b", "c");

        await ApprovalChainBuilder.RebuildIntermediateAsync(
            request, h.Db, ["d", "e"], new FakeIdentityService("d", "e"), default);
        await h.Db.SaveChangesAsync();

        var chain = await ReloadChainAsync(h, request.Id);

        Assert.All(chain, s => Assert.True(s.StepOrder > 0, $"StepOrder {s.StepOrder} was left parked"));
        Assert.Equal([1, 2, 3], chain.Select(s => s.StepOrder));
    }
}
