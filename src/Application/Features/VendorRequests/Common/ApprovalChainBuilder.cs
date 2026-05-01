using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

/// <summary>
/// Helpers for building and validating approval chains.
/// Used by Create, SaveDraft, Resubmit, BuyerUpdateCompleted.
/// </summary>
public static class ApprovalChainBuilder
{
    public static async Task ValidateApproversAsync(
        IReadOnlyList<string> approverIds, IIdentityService identity, CancellationToken ct)
    {
        if (approverIds.Count == 0) return;

        foreach (var aid in approverIds)
        {
            var user = await identity.FindByIdAsync(aid)
                ?? throw new BadRequestException($"Approver ID '{aid}' does not exist.");

            var roles = await identity.GetRolesAsync(aid);
            if (!roles.Contains(Roles.Approver))
                throw new BadRequestException($"User '{user.FullName}' does not have the Approver role.");
        }
    }

    /// <summary>
    /// Appends intermediate approver steps (in order) followed by the final approver step.
    /// Caller must have already validated the approver IDs.
    /// </summary>
    public static async Task BuildAsync(
        VendorRequest request, IReadOnlyList<string> approverIds,
        IIdentityService identity, CancellationToken ct)
    {
        var stepOrder = 1;
        foreach (var aid in approverIds)
        {
            var user = await identity.FindByIdAsync(aid);
            if (user is null) continue;
            request.ApprovalSteps.Add(new ApprovalStep
            {
                ApproverUserId = aid,
                ApproverName = user.FullName,
                StepOrder = stepOrder++,
                IsFinalApproval = false
            });
        }

        var finalUser = await identity.FindByEmailAsync(SystemAccounts.FinalApproverEmail)
            ?? throw new NotFoundException("Final Approver account not found. Contact admin.");

        request.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId = finalUser.Id,
            ApproverName = finalUser.FullName,
            StepOrder = stepOrder,
            IsFinalApproval = true
        });
    }
}
