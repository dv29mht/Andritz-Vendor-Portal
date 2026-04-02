namespace AndritzVendorPortal.API.Infrastructure;

public class EmailSettings
{
    public string ResendApiKey { get; set; } = "";
    public string FromEmail    { get; set; } = "onboarding@resend.dev";
    public string FromName     { get; set; } = "Andritz Vendor Portal";
}
