namespace AndritzVendorPortal.Domain.Entities;

// One row per (UserId, Role). TokensValidSince is compared against the
// JWT's `iat` claim on every authenticated request — any token issued
// before this timestamp is rejected. Bump it on logout-everywhere,
// password change, or role revocation to invalidate prior sessions
// for that user/role combination.
public class LoginSecurity
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime TokensValidSince { get; set; }
}
