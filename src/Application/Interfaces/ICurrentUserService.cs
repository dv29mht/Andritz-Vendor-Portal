namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Resolves the currently-authenticated user from the HTTP context.
/// Implemented in API layer; consumed by Application handlers.
/// </summary>
public interface ICurrentUserService
{
    string? UserId { get; }
    string? Email { get; }
    string? FullName { get; }
    bool IsAuthenticated { get; }
    bool IsInRole(string role);
    string RequireUserId();
}
