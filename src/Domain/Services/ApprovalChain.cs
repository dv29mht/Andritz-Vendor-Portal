using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;

namespace AndritzVendorPortal.Domain.Services;

/// <summary>
/// Pure domain logic for the sequential approval chain.
/// No EF, no DI — testable without infrastructure.
/// </summary>
public static class ApprovalChain
{
    public static ApprovalStep? GetPendingStepForUser(
        IEnumerable<ApprovalStep> steps, string userId)
    {
        var myStep = steps
            .Where(s => s.ApproverUserId == userId && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        if (myStep is null) return null;

        bool blocked = steps.Any(s =>
            s.StepOrder < myStep.StepOrder &&
            s.Decision == ApprovalDecision.Pending &&
            !s.IsDeletedApprover);

        return blocked ? null : myStep;
    }

    public static void AdvanceWorkflow(VendorRequest request)
    {
        var actionableNonFinalSteps = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval && !s.IsDeletedApprover)
            .ToList();

        bool allTechnicalApproved = actionableNonFinalSteps.Count > 0
            && actionableNonFinalSteps.All(s => s.Decision == ApprovalDecision.Approved);

        bool allDeleted = actionableNonFinalSteps.Count == 0
            && request.ApprovalSteps.Any(s => !s.IsFinalApproval && s.IsDeletedApprover);

        bool noIntermediateSteps = actionableNonFinalSteps.Count == 0
            && !request.ApprovalSteps.Any(s => !s.IsFinalApproval);

        if (allTechnicalApproved || allDeleted || noIntermediateSteps)
            request.Status = VendorRequestStatus.PendingFinalApproval;
    }
}
