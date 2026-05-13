namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Encodes and decodes signed, time-limited tokens for one-click email approvals.
/// Tokens are stateless — single-use is enforced by the approval step's own state
/// (an already-acted step has DecidedAt != null, so re-using the token is a no-op error).
/// </summary>
public interface IEmailActionTokenService
{
    string Generate(int vendorRequestId, int stepId, string userId, string action);

    bool TryValidate(string token, out EmailActionPayload payload, out string? error);
}

public record EmailActionPayload(int VendorRequestId, int StepId, string UserId, string Action, DateTime ExpiresAt);
