using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Logging;

namespace AndritzVendorPortal.Application.Behaviors;

/// <summary>
/// After a workflow command that returns a <see cref="VendorRequestDetailDto"/>
/// succeeds, write one persisted <see cref="Notification"/> row per recipient for
/// that specific action. Because each action writes its own rows, the full history
/// of a form is retained (submit → reject → resubmit yields a notification per event
/// instead of collapsing to the latest state). The frontend reads these from
/// /api/notifications and refetches on the SignalR <c>workflowChanged</c> event, so
/// delivery is real-time. Failures are logged and swallowed — notifications are
/// best-effort and must never break the underlying workflow command.
/// </summary>
public class NotificationBehavior<TRequest, TResponse>(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IDateTimeProvider clock,
    ILogger<NotificationBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        var response = await next();

        if (response is VendorRequestDetailDto dto)
        {
            try { await WriteAsync(typeof(TRequest).Name, dto, ct); }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Notify] Failed writing notifications for {Command}", typeof(TRequest).Name);
            }
        }

        return response;
    }

    private async Task WriteAsync(string commandName, VendorRequestDetailDto dto, CancellationToken ct)
    {
        var actor       = currentUser.UserId;
        var actorName   = currentUser.FullName ?? "Someone";
        var vendor      = dto.VendorName;
        var buyerId     = dto.CreatedByUserId;
        var buyerName   = dto.CreatedByName;
        var finalApprover = dto.ApprovalSteps.FirstOrDefault(s => s.IsFinalApproval)?.ApproverUserId;
        var nextPending   = dto.ApprovalSteps
            .Where(s => s.Decision == ApprovalDecision.Pending)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault()?.ApproverUserId;

        var rows = new List<Notification>();
        void Add(string? recipient, string type, string title, string body)
        {
            if (string.IsNullOrEmpty(recipient)) return;
            if (recipient == actor) return; // never notify the actor about their own action
            rows.Add(new Notification
            {
                RecipientUserId = recipient,
                VendorRequestId = dto.Id,
                Type = type,
                Title = title,
                Body = body,
                IsRead = false,
                CreatedAt = clock.UtcNow,
            });
        }

        switch (commandName)
        {
            case "CreateVendorRequestCommand":
            case "SubmitVendorRequestCommand":
                Add(finalApprover, "Submitted", "New vendor request submitted",
                    $"{buyerName} submitted \"{vendor}\" for registration.");
                if (nextPending != finalApprover)
                    Add(nextPending, "AssignedForReview", "New request for your review",
                        $"{buyerName} submitted \"{vendor}\" — awaiting your review.");
                break;

            case "ResubmitVendorRequestCommand":
                Add(finalApprover, "Resubmitted", "Vendor request resubmitted",
                    $"{buyerName} resubmitted \"{vendor}\".");
                if (nextPending != finalApprover)
                    Add(nextPending, "AssignedForReview", "Request resubmitted for your review",
                        $"{buyerName} resubmitted \"{vendor}\" — awaiting your review.");
                break;

            case "ApproveVendorRequestCommand":
                Add(buyerId, "StepApproved", "Approval step cleared",
                    $"{actorName} approved \"{vendor}\".");
                Add(finalApprover, "StepApproved", "Approval progressed",
                    $"{actorName} approved \"{vendor}\".");
                if (nextPending != finalApprover)
                    Add(nextPending, "AssignedForReview", "Pending your review",
                        $"\"{vendor}\" is now awaiting your review.");
                break;

            case "RejectVendorRequestCommand":
                Add(buyerId, "Rejected", "Request rejected",
                    $"\"{vendor}\" was rejected. Please revise and resubmit.");
                Add(finalApprover, "Rejected", "Request rejected",
                    $"{actorName} rejected \"{vendor}\".");
                break;

            case "CompleteVendorRequestCommand":
                Add(buyerId, "Completed", "Vendor approved",
                    $"\"{vendor}\" is fully approved — Vendor Code {dto.VendorCode}.");
                break;

            case "BuyerUpdateCompletedCommand":
                Add(finalApprover, "BuyerUpdated", "Buyer updated vendor details",
                    $"{buyerName} updated details for \"{vendor}\".");
                break;

            default:
                return; // drafts, admin edits, classify, archive, restore — not notifiable
        }

        if (rows.Count == 0) return;

        foreach (var row in rows) db.Notifications.Add(row);
        await db.SaveChangesAsync(ct);
    }
}
