namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Pushes a "workflowChanged" event to connected clients (buyer, approvers, admins)
/// so the frontend can refresh its state without polling.
/// SignalR implementation lives in the API layer.
/// </summary>
public interface INotificationService
{
    Task BroadcastWorkflowChangeAsync(int requestId, IEnumerable<string> userIds, CancellationToken ct = default);
}
