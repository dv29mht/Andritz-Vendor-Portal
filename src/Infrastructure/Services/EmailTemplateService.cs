using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// Loads <see cref="Domain.Entities.EmailTemplate"/> rows by Code, substitutes
/// [Placeholder] tokens, and wraps the result in the branded HTML shell.
/// Falls back to the seed defaults if the row is missing (e.g. before the
/// initial seed has run on a fresh database).
/// </summary>
public class EmailTemplateService(
    IApplicationDbContext db,
    ILogger<EmailTemplateService> logger) : IEmailTemplateService
{
    public async Task<(string Subject, string HtmlBody)> RenderAsync(
        string code,
        IReadOnlyDictionary<string, string?> values,
        CancellationToken ct = default,
        string? actionFooterHtml = null)
    {
        var tpl = await db.EmailTemplates.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Code == code, ct);

        string subjectText;
        string bodyText;

        if (tpl is null)
        {
            var fallback = EmailTemplateDefaults.All.FirstOrDefault(d => d.Code == code);
            if (fallback is null)
            {
                logger.LogError("[EmailTemplate] No template found for code {Code}", code);
                return ($"[{code}]", $"<p>Template {code} is not configured.</p>");
            }
            subjectText = fallback.Subject;
            bodyText = fallback.BodyText;
        }
        else
        {
            subjectText = tpl.Subject;
            bodyText = tpl.BodyText;
        }

        var subject = Substitute(subjectText, values);
        var bodyPlain = Substitute(bodyText, values);
        var preheader = FirstNonEmptyLine(bodyPlain);
        var html = EmailHtmlShell.Wrap(subject, preheader, bodyPlain, actionFooterHtml);
        return (subject, html);
    }

    private static string Substitute(string text, IReadOnlyDictionary<string, string?> values)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var result = text;
        foreach (var kv in values)
        {
            var token = kv.Key;
            if (string.IsNullOrEmpty(token)) continue;
            var replacement = string.IsNullOrEmpty(kv.Value) ? "—" : kv.Value;
            result = result.Replace(token, replacement);
        }
        return result;
    }

    private static string FirstNonEmptyLine(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        foreach (var line in text.Replace("\r\n", "\n").Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.Length > 0) return trimmed.Length > 120 ? trimmed[..120] : trimmed;
        }
        return string.Empty;
    }
}
