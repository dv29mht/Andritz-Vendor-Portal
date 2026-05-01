namespace AndritzVendorPortal.Infrastructure.Authentication;

public class JwtSettings
{
    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = "AndritzVendorPortal";
    public string Audience { get; set; } = "AndritzVendorPortalClient";
    public int ExpiryHours { get; set; } = 8;
}
