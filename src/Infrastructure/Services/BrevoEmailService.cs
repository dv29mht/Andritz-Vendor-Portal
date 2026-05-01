using AndritzVendorPortal.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// Sends transactional emails via the Brevo (Sendinblue) HTTP API.
/// All exceptions are caught and logged — email failures must not block business workflows.
/// </summary>
public class BrevoEmailService(
    IOptions<EmailSettings> options,
    ILogger<BrevoEmailService> logger,
    IHttpClientFactory httpFactory) : IEmailService
{
    private readonly EmailSettings _cfg = options.Value;

    public async Task SendAsync(string to, string subject, string htmlBody)
    {
        if (string.IsNullOrWhiteSpace(_cfg.BrevoApiKey))
        {
            logger.LogInformation("[Email] Brevo API key missing — skipping email to {To}: {Subject}", to, subject);
            return;
        }

        try
        {
            var client = httpFactory.CreateClient();
            client.DefaultRequestHeaders.Add("api-key", _cfg.BrevoApiKey);
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var payload = new
            {
                sender = new { name = _cfg.FromName, email = _cfg.FromEmail },
                to = new[] { new { email = to } },
                subject,
                htmlContent = htmlBody
            };

            using var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await client.PostAsync("https://api.brevo.com/v3/smtp/email", content);
            if (response.IsSuccessStatusCode)
                logger.LogInformation("[Email] Sent to {To}: {Subject}", to, subject);
            else
            {
                var body = await response.Content.ReadAsStringAsync();
                logger.LogError("[Email] Brevo API error {Status} for {To}: {Body}", (int)response.StatusCode, to, body);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Email] Failed to send to {To}: {Subject}", to, subject);
        }
    }
}
