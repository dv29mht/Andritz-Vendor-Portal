using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// Unit tests for the sequential approval-chain logic in <see cref="ApprovalChain"/>.
/// No database, no HTTP stack — pure model objects only.
/// </summary>
public class ApprovalChainTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static ApprovalStep Step(int order, string userId,
        ApprovalDecision decision = ApprovalDecision.Pending,
        bool isFinal = false) => new()
    {
        StepOrder      = order,
        ApproverUserId = userId,
        Decision       = decision,
        IsFinalApproval= isFinal,
    };

    private static VendorRequest RequestWith(
        VendorRequestStatus status, params ApprovalStep[] steps)
    {
        var req = new VendorRequest { Status = status };
        foreach (var s in steps) req.ApprovalSteps.Add(s);
        return req;
    }

    // ── GetPendingStepForUser ─────────────────────────────────────────────────

    [Fact]
    public void GetPendingStep_ReturnsStep_WhenUserIsFirstAndOnlyApprover()
    {
        var steps = new[] { Step(1, "userA") };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userA");
        Assert.NotNull(result);
        Assert.Equal(1, result.StepOrder);
    }

    [Fact]
    public void GetPendingStep_ReturnsNull_WhenUserHasNoStep()
    {
        var steps = new[] { Step(1, "userA") };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userB");
        Assert.Null(result);
    }

    [Fact]
    public void GetPendingStep_ReturnsNull_WhenEarlierStepIsStillPending()
    {
        // userB is step 2, but step 1 (userA) hasn't been decided yet
        var steps = new[]
        {
            Step(1, "userA", ApprovalDecision.Pending),
            Step(2, "userB", ApprovalDecision.Pending),
        };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userB");
        Assert.Null(result);
    }

    [Fact]
    public void GetPendingStep_ReturnsStep_WhenAllEarlierStepsAreApproved()
    {
        var steps = new[]
        {
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "userB", ApprovalDecision.Pending),
        };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userB");
        Assert.NotNull(result);
        Assert.Equal(2, result.StepOrder);
    }

    [Fact]
    public void GetPendingStep_ReturnsNull_WhenUserStepAlreadyDecided()
    {
        var steps = new[] { Step(1, "userA", ApprovalDecision.Approved) };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userA");
        Assert.Null(result);
    }

    [Fact]
    public void GetPendingStep_ThreeStepChain_BlocksStepThreeUntilStepTwoDone()
    {
        var steps = new[]
        {
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "userB", ApprovalDecision.Pending),
            Step(3, "userC", ApprovalDecision.Pending),
        };
        // userC (step 3) blocked because userB (step 2) is still pending
        Assert.Null(ApprovalChain.GetPendingStepForUser(steps, "userC"));
        // userB (step 2) unblocked because step 1 is approved
        Assert.NotNull(ApprovalChain.GetPendingStepForUser(steps, "userB"));
    }

    // ── AdvanceWorkflow ───────────────────────────────────────────────────────

    [Fact]
    public void AdvanceWorkflow_AdvancesToPendingFinalApproval_WhenAllNonFinalStepsApproved()
    {
        var req = RequestWith(
            VendorRequestStatus.PendingApproval,
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "userB", ApprovalDecision.Approved),
            Step(3, "pardeep", ApprovalDecision.Pending, isFinal: true));

        ApprovalChain.AdvanceWorkflow(req);

        Assert.Equal(VendorRequestStatus.PendingFinalApproval, req.Status);
    }

    [Fact]
    public void AdvanceWorkflow_StaysPendingApproval_WhenSomeNonFinalStillPending()
    {
        var req = RequestWith(
            VendorRequestStatus.PendingApproval,
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "userB", ApprovalDecision.Pending),
            Step(3, "pardeep", ApprovalDecision.Pending, isFinal: true));

        ApprovalChain.AdvanceWorkflow(req);

        Assert.Equal(VendorRequestStatus.PendingApproval, req.Status);
    }

    [Fact]
    public void AdvanceWorkflow_StaysPendingApproval_WhenNoNonFinalStepsExist()
    {
        // Edge case: only a final step (no intermediate approvers configured)
        var req = RequestWith(
            VendorRequestStatus.PendingApproval,
            Step(1, "pardeep", ApprovalDecision.Pending, isFinal: true));

        ApprovalChain.AdvanceWorkflow(req);

        // nonFinalSteps.Count == 0 → allTechnicalApproved = false → no advance
        Assert.Equal(VendorRequestStatus.PendingApproval, req.Status);
    }

    [Fact]
    public void AdvanceWorkflow_SingleNonFinalApprover_AdvancesOnceApproved()
    {
        var req = RequestWith(
            VendorRequestStatus.PendingApproval,
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "pardeep", ApprovalDecision.Pending, isFinal: true));

        ApprovalChain.AdvanceWorkflow(req);

        Assert.Equal(VendorRequestStatus.PendingFinalApproval, req.Status);
    }
}
