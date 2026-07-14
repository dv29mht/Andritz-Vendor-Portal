using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;

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

    /// <summary>
    /// Rewrites the intermediate approver chain in place, leaving the final approver last.
    /// Caller must have already validated the approver IDs.
    ///
    /// <para>This is an upsert, not the delete-then-reinsert it replaces. The old pattern removed
    /// every intermediate step and re-added the new chain from StepOrder 1, so two concurrent
    /// save-drafts of the same request each tried to INSERT StepOrder=1 and one died on
    /// <c>Cannot insert duplicate key row in object 'dbo.ApprovalSteps' with unique index
    /// 'IX_ApprovalSteps_VendorRequestId_StepOrder'</c> → HTTP 500. Reusing the existing rows means
    /// an unchanged-length chain issues nothing but UPDATEs, which cannot collide on that index.</para>
    ///
    /// <para>Growing or shrinking the chain still moves the final approver's StepOrder onto a slot
    /// another row currently occupies, and EF gives no guarantee about the order of statements
    /// within a batch. So the shuffle is done in two steps: park the rows that must move at
    /// negative StepOrders (a range nothing else ever uses), flush, then settle them on their real
    /// orders. Both flushes are inside the caller's transaction, so the pair is still atomic.</para>
    /// </summary>
    public static async Task RebuildIntermediateAsync(
        VendorRequest request, IApplicationDbContext db, IReadOnlyList<string> approverIds,
        IIdentityService identity, CancellationToken ct)
    {
        // Resolve first — an id with no matching user is skipped, as the previous code did.
        var resolved = new List<(string Id, string Name)>();
        foreach (var aid in approverIds)
        {
            var user = await identity.FindByIdAsync(aid);
            if (user is not null) resolved.Add((aid, user.FullName));
        }

        var existing = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .ToList();
        var finalStep = request.ApprovalSteps.FirstOrDefault(s => s.IsFinalApproval);

        var reused = existing.Take(resolved.Count).ToList();

        // Does any surviving row have to change its StepOrder? If not — the chain kept its length
        // and every row is already sitting where it belongs — the rewrite is pure UPDATEs of
        // ApproverUserId/Name and no slot is ever contested. That is the common case; skip the
        // shuffle and its extra round-trip entirely.
        var needsRenumber =
            existing.Count != resolved.Count
            || reused.Where((s, i) => s.StepOrder != i + 1).Any()
            || (finalStep is not null && finalStep.StepOrder != resolved.Count + 1);

        if (needsRenumber)
        {
            // Drop the surplus when the new chain is shorter, and park every surviving row at a
            // StepOrder nothing can be holding, so that the settling pass below can never write a
            // slot that is still occupied. Negative orders are never observable: they exist only
            // between these two SaveChanges, inside the caller's transaction.
            foreach (var surplus in existing.Skip(resolved.Count))
            {
                request.ApprovalSteps.Remove(surplus);
                db.ApprovalSteps.Remove(surplus);
            }

            var park = -1;
            foreach (var step in reused) step.StepOrder = park--;
            if (finalStep is not null) finalStep.StepOrder = park;

            await db.SaveChangesAsync(ct);
        }

        // Every real StepOrder is free now. Settle the chain.
        for (var i = 0; i < resolved.Count; i++)
        {
            var (id, name) = resolved[i];
            if (i < reused.Count)
            {
                var step = reused[i];
                step.ApproverUserId = id;
                step.ApproverName = name;
                step.StepOrder = i + 1;
                step.Decision = ApprovalDecision.Pending;
                step.Comment = null;
                step.DecidedAt = null;
                step.IsDeletedApprover = false;
                step.DeletedApproverNote = null;
            }
            else
            {
                request.ApprovalSteps.Add(new ApprovalStep
                {
                    ApproverUserId = id,
                    ApproverName = name,
                    StepOrder = i + 1,
                    IsFinalApproval = false
                });
            }
        }

        if (finalStep is not null) finalStep.StepOrder = resolved.Count + 1;
    }
}
