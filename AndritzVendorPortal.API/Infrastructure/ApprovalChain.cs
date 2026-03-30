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
    ///   <item>an earlier step in the chain is still pending (sequential blocking).</item>
    /// </list>
    /// </summary>
    public static ApprovalStep? GetPendingStepForUser(
        IEnumerable<ApprovalStep> steps, string userId)
    {
        var myStep = steps
            .Where(s => s.ApproverUserId == userId && s.Decision == ApprovalDecision.Pending)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();

        if (myStep is null) return null;

        // Sequential chain: block if any earlier step is still pending
        bool blocked = steps.Any(
            s => s.StepOrder < myStep.StepOrder && s.Decision == ApprovalDecision.Pending);

        return blocked ? null : myStep;
    }

    /// <summary>
    /// Advances the request status after an intermediate approval step is recorded.
    /// Sets <c>Status = PendingFinalApproval</c> when all non-final steps are approved;
    /// otherwise leaves status as <c>PendingApproval</c>.
    /// </summary>
    public static void AdvanceWorkflow(VendorRequest request)
    {
        var nonFinalSteps = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval)
            .ToList();

        bool allTechnicalApproved = nonFinalSteps.Count > 0
            && nonFinalSteps.All(s => s.Decision == ApprovalDecision.Approved);

        if (allTechnicalApproved)
            request.Status = VendorRequestStatus.PendingFinalApproval;
        // else: status stays PendingApproval — remaining approvers still need to act
    }
}
