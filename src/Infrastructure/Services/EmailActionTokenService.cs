using AndritzVendorPortal.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// HMAC-SHA256 signed tokens for one-click email approval links.
/// Format: base64url(payloadJson).base64url(signature). 7-day default TTL.
/// Re-use is prevented at the business layer — the underlying approval step
/// can only transition Pending → Approved/Rejected once.
/// </summary>
public class EmailActionTokenService(IConfiguration config) : IEmailActionTokenService
{
    private static readonly TimeSpan DefaultTtl = TimeSpan.FromDays(7);

    private byte[] SigningKey()
    {
        // Reuse the JWT signing secret — already a 32+ char random configured value.
        var key = config["Jwt:Key"] ?? "PLACEHOLDER_KEY_REPLACE_VIA_CONFIG";
        return Encoding.UTF8.GetBytes("email-action:" + key);
    }

    public string Generate(int vendorRequestId, int stepId, string userId, string action)
    {
        var payload = new EmailActionPayload(
            vendorRequestId, stepId, userId, action,
            DateTime.UtcNow.Add(DefaultTtl));

        var json = JsonSerializer.Serialize(payload);
        var payloadBytes = Encoding.UTF8.GetBytes(json);

        using var hmac = new HMACSHA256(SigningKey());
        var sig = hmac.ComputeHash(payloadBytes);

        return $"{Base64Url(payloadBytes)}.{Base64Url(sig)}";
    }

    public bool TryValidate(string token, out EmailActionPayload payload, out string? error)
    {
        payload = null!;
        error = null;

        if (string.IsNullOrWhiteSpace(token))
        {
            error = "Token is missing.";
            return false;
        }

        var parts = token.Split('.', 2);
        if (parts.Length != 2)
        {
            error = "Token is malformed.";
            return false;
        }

        byte[] payloadBytes;
        byte[] providedSig;
        try
        {
            payloadBytes = FromBase64Url(parts[0]);
            providedSig = FromBase64Url(parts[1]);
        }
        catch
        {
            error = "Token is malformed.";
            return false;
        }

        using var hmac = new HMACSHA256(SigningKey());
        var expectedSig = hmac.ComputeHash(payloadBytes);

        if (!CryptographicOperations.FixedTimeEquals(providedSig, expectedSig))
        {
            error = "Token signature is invalid.";
            return false;
        }

        try
        {
            payload = JsonSerializer.Deserialize<EmailActionPayload>(payloadBytes)!;
        }
        catch
        {
            error = "Token payload is unreadable.";
            return false;
        }

        if (payload.ExpiresAt < DateTime.UtcNow)
        {
            error = "This approval link has expired. Please act from the portal.";
            return false;
        }

        return true;
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
