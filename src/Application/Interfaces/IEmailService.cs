namespace AndritzVendorPortal.Application.Interfaces;

public interface IEmailService
{
    /// <summary>Sends an HTML email. Never throws — failures are logged and swallowed.</summary>
    Task SendAsync(string to, string subject, string htmlBody);
}
