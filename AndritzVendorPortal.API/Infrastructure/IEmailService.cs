namespace AndritzVendorPortal.API.Infrastructure;

public interface IEmailService
{
    /// <summary>
    /// Sends an HTML email. Never throws — failures are logged and swallowed
    /// so that email errors never block workflow operations.
    /// </summary>
    Task SendAsync(string to, string subject, string htmlBody);
}
