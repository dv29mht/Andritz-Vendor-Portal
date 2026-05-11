using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;

namespace AndritzVendorPortal.Application.Behaviors;

/// <summary>
/// After any command that returns a <see cref="VendorRequestDetailDto"/> succeeds,
/// broadcast a workflowChanged event to interested clients (buyer + approvers + admins).
/// Read-only queries (which also return this type) are filtered out by checking
/// the request type name suffix.
/// </summary>
public class WorkflowBroadcastBehavior<TRequest, TResponse>(INotificationService notifications)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        var response = await next();

        // Only broadcast for commands (not queries) that produced a detail DTO
        if (response is VendorRequestDetailDto dto && IsStateMutating(typeof(TRequest).Name))
        {
            var userIds = new HashSet<string> { dto.CreatedByUserId };
            foreach (var step in dto.ApprovalSteps)
                userIds.Add(step.ApproverUserId);

            await notifications.BroadcastWorkflowChangeAsync(dto.Id, userIds, ct);
        }

        return response;
    }

    private static bool IsStateMutating(string requestName) =>
        requestName.EndsWith("Command", StringComparison.Ordinal);
}
