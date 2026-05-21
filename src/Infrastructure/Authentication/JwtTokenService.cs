using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AndritzVendorPortal.Infrastructure.Authentication;

public class JwtTokenService(IOptions<JwtSettings> settings, IDateTimeProvider clock) : IJwtTokenService
{
    private readonly JwtSettings _settings = settings.Value;

    public (string Token, DateTime ExpiresAt) GenerateToken(UserInfoDto user, IEnumerable<string> roles)
    {
        if (string.IsNullOrWhiteSpace(_settings.SecretKey))
            throw new InvalidOperationException("JWT signing key is not configured.");

        // iat is stamped from our IDateTimeProvider (UTC) so it lines up with
        // LoginSecurity.TokensValidSince comparisons in OnTokenValidated.
        // Clock skew is set to zero in the bearer config, so we need
        // second-level precision here too.
        var issuedAt = clock.UtcNow;
        var issuedAtUnix = new DateTimeOffset(issuedAt).ToUnixTimeSeconds();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.FullName),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Iat, issuedAtUnix.ToString(), ClaimValueTypes.Integer64)
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresAt = issuedAt.AddHours(_settings.ExpiryHours);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: issuedAt,
            expires: expiresAt,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}
