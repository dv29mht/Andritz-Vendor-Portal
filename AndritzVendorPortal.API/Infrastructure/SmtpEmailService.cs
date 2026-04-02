using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AndritzVendorPortal.API.Infrastructure;

public class SmtpEmailService(
    IOptions<EmailSettings> options,
    ILogger<SmtpEmailService> logger,
    IHttpClientFactory httpClientFactory) : IEmailService
{
    private readonly EmailSettings _cfg = options.Value;

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        if (string.IsNullOrWhiteSpace(_cfg.ResendApiKey))
        {
            logger.LogInformation(
                "[Email] Resend API key not configured — skipping email to {To}: {Subject}", to, subject);
            return;
        }

        try
        {
            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", _cfg.ResendApiKey);

            var payload = new
            {
                from    = $"{_cfg.FromName} <{_cfg.FromEmail}>",
                to      = new[] { to },
                subject,
                html    = htmlBody,
            };

            var content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync("https://api.resend.com/emails", content);

            if (response.IsSuccessStatusCode)
                logger.LogInformation("[Email] Sent to {To}: {Subject}", to, subject);
            else
            {
                var body = await response.Content.ReadAsStringAsync();
                logger.LogError("[Email] Resend API error {Status} for {To}: {Body}", (int)response.StatusCode, to, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Email] Failed to send to {To}: {Subject}", to, subject);
        }
    }
}
