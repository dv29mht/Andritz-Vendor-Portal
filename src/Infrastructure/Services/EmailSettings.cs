namespace AndritzVendorPortal.Infrastructure.Services;

public class EmailSettings
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 25;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = false;
    public string FromEmail { get; set; } = "noreply@andritz.com";
    public string FromName { get; set; } = "Andritz Vendor Portal";
}
