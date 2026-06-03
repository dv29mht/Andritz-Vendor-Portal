using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace AndritzVendorPortal.Infrastructure.Services;

/// <summary>
/// Loads <see cref="Domain.Entities.EmailTemplate"/> rows by Code, substitutes
/// [Placeholder] tokens, and wraps the result in the branded HTML shell.
/// Falls back to the seed defaults if the row is missing (e.g. before the
/// initial seed has run on a fresh database).
/// </summary>
public partial class EmailTemplateService(
    IApplicationDbContext db,
    IConfiguration config,
    IMemoryCache cache,
    ILogger<EmailTemplateService> logger) : IEmailTemplateService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);

    // Matches a single [Placeholder] token. Used for a single left-to-right pass so a
    // substituted value that itself contains "[Something]" can never be re-substituted.
    [GeneratedRegex(@"\[[^\[\]]+\]")]
    private static partial Regex PlaceholderRegex();

    private static string CacheKey(string code) => $"email-template:{code}";

    public void Invalidate(string code) => cache.Remove(CacheKey(code));

    public async Task<(string Subject, string HtmlBody)> RenderAsync(
        string code,
        IReadOnlyDictionary<string, string?> values,
        CancellationToken ct = default,
        string? actionFooterHtml = null)
    {
        var (subjectText, bodyText, ok) = await LoadAsync(code, ct);
        if (!ok)
            return ($"[{code}]", $"<p>Template {code} is not configured.</p>");

        var subject = Substitute(subjectText, values);
        var bodyPlain = Substitute(bodyText, values);
        var preheader = FirstNonEmptyLine(bodyPlain);
        var portalUrl = config["PortalUrl"];
        var html = EmailHtmlShell.Wrap(subject, preheader, bodyPlain, actionFooterHtml, portalUrl);
        return (subject, html);
    }

    // Resolves the template text for a code, caching the DB row (or seed fallback) so
    // a burst of emails doesn't hit the database once per render. Cache is dropped by
    // Invalidate() when an admin edits or resets the template.
    private async Task<(string Subject, string Body, bool Ok)> LoadAsync(string code, CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey(code), out (string Subject, string Body, bool Ok) cached))
            return cached;

        var tpl = await db.EmailTemplates.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Code == code, ct);

        (string Subject, string Body, bool Ok) resolved;
        if (tpl is not null)
        {
            resolved = (tpl.Subject, tpl.BodyText, true);
        }
        else
        {
            var fallback = EmailTemplateDefaults.All.FirstOrDefault(d => d.Code == code);
            if (fallback is null)
            {
                logger.LogError("[EmailTemplate] No template found for code {Code}", code);
                return (string.Empty, string.Empty, false); // don't cache misconfiguration
            }
            resolved = (fallback.Subject, fallback.BodyText, true);
        }

        cache.Set(CacheKey(code), resolved, CacheTtl);
        return resolved;
    }

    // Single left-to-right pass: each [Placeholder] is matched once against the
    // original text and replaced from the dictionary. Sequential string.Replace
    // re-scanned already-substituted text, so a vendor name containing a literal
    // "[Token]" could corrupt the body — this can't, because substituted values are
    // never re-examined. Unknown tokens are left intact rather than blanked.
    private static string Substitute(string text, IReadOnlyDictionary<string, string?> values)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        return PlaceholderRegex().Replace(text, m =>
        {
            if (!values.TryGetValue(m.Value, out var value)) return m.Value;
            return string.IsNullOrEmpty(value) ? "—" : value;
        });
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
