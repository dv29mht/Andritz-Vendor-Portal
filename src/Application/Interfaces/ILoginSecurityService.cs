namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Token-revocation surface for JWT bearer auth. Each (UserId, Role) pair has
/// a TokensValidSince timestamp; the bearer middleware rejects any token whose
/// `iat` claim falls before that timestamp. Bump it on logout, password change,
/// or role revocation.
/// </summary>
public interface ILoginSecurityService
{
    /// <summary>
    /// Returns the TokensValidSince for the given (userId, role), or null if
    /// no revocation row exists (meaning: no tokens have been revoked yet).
    /// </summary>
    Task<DateTime?> GetTokensValidSinceAsync(string userId, string role, CancellationToken ct = default);

    /// <summary>
    /// Bumps TokensValidSince to now for every role the user holds, invalidating
    /// all previously issued tokens. Creates rows as needed.
    /// </summary>
    Task RevokeAllAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default);

    /// <summary>
    /// Bumps TokensValidSince to now for a single (userId, role) pair.
    /// Creates the row if it does not exist.
    /// </summary>
    Task RevokeAsync(string userId, string role, CancellationToken ct = default);
}
