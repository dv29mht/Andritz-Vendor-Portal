using AndritzVendorPortal.Application.DTOs;

namespace AndritzVendorPortal.Application.Interfaces;

public interface IJwtTokenService
{
    /// <summary>Issues a signed JWT for the given user. Returns token + expiry.</summary>
    (string Token, DateTime ExpiresAt) GenerateToken(UserInfoDto user, IEnumerable<string> roles);
}
