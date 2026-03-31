using AndritzVendorPortal.API.Models;

namespace AndritzVendorPortal.API.Infrastructure;

/// <summary>
/// Pure static helpers for the sequential approval-chain logic.
/// Extracted from VendorRequestController so they can be unit-tested
/// without standing up the full ASP.NET pipeline.
/// </summary>
public static class ApprovalChain
{
    /// <summary>
    /// Returns the pending approval step assigned to <paramref name="userId"/>,
    /// or <c>null</c> if:
    /// <list type="bullet">
    ///   <item>no pending step exists for that user, or</item>
    ///   <item>an earlier non-deleted step in the chain is still pending (sequential blocking).</item>
    /// </list>
    /// Deleted-approver steps (<see cref="ApprovalStep.IsDeletedApprover"/>) are
    /// invisible to the sequencing logic — they do not block and are never returned.
    /// </summary>
    public static ApprovalStep? GetPendingStepForUser(
        IEnumerable<ApprovalStep> steps, string userId)
    {
        var myStep = steps
            .Where(s => s.ApproverUserId == userId && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        if (myStep is null) return null;

        // Sequential chain: block if any earlier non-deleted step is still pending
        bool blocked = steps.Any(s =>
            s.StepOrder < myStep.StepOrder &&
            s.Decision == ApprovalDecision.Pending &&
            !s.IsDeletedApprover);

        return blocked ? null : myStep;
    }

    /// <summary>
    /// Advances the request status after an intermediate approval step is recorded.
    /// Sets <c>Status = PendingFinalApproval</c> when all non-final, non-deleted steps
    /// are approved; otherwise leaves status as <c>PendingApproval</c>.
    /// Deleted-approver steps are treated as already cleared.
    /// </summary>
    public static void AdvanceWorkflow(VendorRequest request)
    {
        // Non-final steps that still require a real decision (i.e. not deleted)
        var actionableNonFinalSteps = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval && !s.IsDeletedApprover)
            .ToList();

        bool allTechnicalApproved = actionableNonFinalSteps.Count > 0
            && actionableNonFinalSteps.All(s => s.Decision == ApprovalDecision.Approved);

        // Edge case: if ALL non-final steps were deleted (empty actionable list)
        // and there are deleted steps (meaning there was a chain at some point),
        // advance to FinalApproval so the request isn't stuck.
        bool allDeleted = actionableNonFinalSteps.Count == 0
            && request.ApprovalSteps.Any(s => !s.IsFinalApproval && s.IsDeletedApprover);

        if (allTechnicalApproved || allDeleted)
            request.Status = VendorRequestStatus.PendingFinalApproval;
        // else: status stays PendingApproval — remaining approvers still need to act
    }
}
