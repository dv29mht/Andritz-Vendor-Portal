namespace AndritzVendorPortal.Infrastructure.Services;

public class EmailSettings
{
    public string BrevoApiKey { get; set; } = string.Empty;
    public string FromEmail { get; set; } = "noreply@andritz.com";
    public string FromName { get; set; } = "Andritz Vendor Portal";
}
