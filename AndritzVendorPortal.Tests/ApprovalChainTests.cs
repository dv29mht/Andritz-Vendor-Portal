using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Domain.Services;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// Pure unit tests for the sequential approval-chain logic in <see cref="ApprovalChain"/>.
/// No DB, no HTTP — domain entities only.
/// </summary>
public class ApprovalChainTests
{
    private static ApprovalStep Step(int order, string userId,
        ApprovalDecision decision = ApprovalDecision.Pending,
        bool isFinal = false) => new()
    {
        StepOrder = order,
        ApproverUserId = userId,
        Decision = decision,
        IsFinalApproval = isFinal
    };

    private static VendorRequest RequestWith(VendorRequestStatus status, params ApprovalStep[] steps)
    {
        var req = new VendorRequest { Status = status };
        foreach (var s in steps) req.ApprovalSteps.Add(s);
        return req;
    }

    [Fact]
    public void GetPendingStep_ReturnsStep_WhenUserIsFirstAndOnlyApprover()
    {
        var steps = new[] { Step(1, "userA") };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userA");
        Assert.NotNull(result);
        Assert.Equal(1, result!.StepOrder);
    }

    [Fact]
    public void GetPendingStep_ReturnsNull_WhenUserHasNoStep()
    {
        var steps = new[] { Step(1, "userA") };
        Assert.Null(ApprovalChain.GetPendingStepForUser(steps, "userB"));
    }

    [Fact]
    public void GetPendingStep_ReturnsNull_WhenEarlierStepIsStillPending()
    {
        var steps = new[]
        {
            Step(1, "userA", ApprovalDecision.Pending),
            Step(2, "userB", ApprovalDecision.Pending)
        };
        Assert.Null(ApprovalChain.GetPendingStepForUser(steps, "userB"));
    }

    [Fact]
    public void GetPendingStep_ReturnsStep_WhenAllEarlierStepsAreApproved()
    {
        var steps = new[]
        {
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "userB", ApprovalDecision.Pending)
        };
        var result = ApprovalChain.GetPendingStepForUser(steps, "userB");
        Assert.NotNull(result);
        Assert.Equal(2, result!.StepOrder);
    }

    [Fact]
    public void GetPendingStep_ReturnsNull_WhenUserStepAlreadyDecided()
    {
        var steps = new[] { Step(1, "userA", ApprovalDecision.Approved) };
        Assert.Null(ApprovalChain.GetPendingStepForUser(steps, "userA"));
    }

    [Fact]
    public void GetPendingStep_ThreeStepChain_BlocksStepThreeUntilStepTwoDone()
    {
        var steps = new[]
        {
            Step(1, "userA", ApprovalDecision.Approved),
            Step(2, "userB", ApprovalDecision.Pending),
            Step(3, "userC", ApprovalDecision.Pending)
        };
        Assert.Null(ApprovalChain.GetPendingStepForUser(steps, "userC"));
        Assert.NotNull(ApprovalChain.GetPendingStepForUser(steps, "userB"));
    }

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
    public void AdvanceWorkflow_NoIntermediateSteps_AdvancesDirectlyToFinal()
    {
        // Edge: buyer submitted directly to final approver — should advance
        var req = RequestWith(
            VendorRequestStatus.PendingApproval,
            Step(1, "pardeep", ApprovalDecision.Pending, isFinal: true));

        ApprovalChain.AdvanceWorkflow(req);
        Assert.Equal(VendorRequestStatus.PendingFinalApproval, req.Status);
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

    [Fact]
    public void AdvanceWorkflow_AllIntermediateDeleted_AdvancesToFinal()
    {
        var req = RequestWith(
            VendorRequestStatus.PendingApproval,
            new ApprovalStep
            {
                StepOrder = 1, ApproverUserId = "userA",
                Decision = ApprovalDecision.Pending, IsDeletedApprover = true
            },
            Step(2, "pardeep", ApprovalDecision.Pending, isFinal: true));

        ApprovalChain.AdvanceWorkflow(req);
        Assert.Equal(VendorRequestStatus.PendingFinalApproval, req.Status);
    }
}
