namespace AndritzVendorPortal.API.Infrastructure;

public class EmailSettings
{
    public string Host      { get; set; } = "";
    public int    Port      { get; set; } = 587;
    public bool   UseSsl    { get; set; } = true;
    public string Username  { get; set; } = "";
    public string Password  { get; set; } = "";
    public string FromEmail { get; set; } = "noreply@andritz.com";
    public string FromName  { get; set; } = "Andritz Vendor Portal";
}
