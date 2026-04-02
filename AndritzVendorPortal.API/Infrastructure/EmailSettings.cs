namespace AndritzVendorPortal.API.Infrastructure;

public class EmailSettings
{
    public string BrevoApiKey { get; set; } = "";
    public string FromEmail   { get; set; } = "noreply@andritz.com";
    public string FromName    { get; set; } = "Andritz Vendor Portal";
}
