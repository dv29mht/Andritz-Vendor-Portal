using System.Net;
using System.Text;

namespace AndritzVendorPortal.Application.Services;

/// <summary>
/// Wraps plain-text email body content in the branded Andritz HTML shell.
/// Plain-text linebreaks become &lt;br/&gt;; bullet lines (•) and "Label: value"
/// rows are styled lightly so admin-edited templates render cleanly without
/// the admin needing to write HTML.
/// </summary>
public static class EmailHtmlShell
{
    /// <summary>
    /// Wraps the plain-text body in the branded Andritz email shell.
    /// </summary>
    /// <param name="title">Used as the &lt;title&gt; and accessible label.</param>
    /// <param name="preheader">Hidden preview text shown by Gmail/Outlook list view.</param>
    /// <param name="plainBody">Plain text body (bullets, label-value rows, paragraphs).</param>
    /// <param name="actionFooterHtml">Pre-built CTA buttons.</param>
    /// <param name="portalUrl">
    /// Public base URL of the portal (e.g. https://andritz-vendor-portal-production.up.railway.app).
    /// Used to build an absolute <c>&lt;img src&gt;</c> for the wordmark logo, which Outlook
    /// and other Microsoft clients will load (they strip data: URIs and inline SVG).
    /// </param>
    public static string Wrap(
        string title,
        string preheader,
        string plainBody,
        string? actionFooterHtml = null,
        string? portalUrl = null)
    {
        var html = FormatBody(plainBody);
        var actions = string.IsNullOrWhiteSpace(actionFooterHtml) ? string.Empty : actionFooterHtml;
        var logoSrc = BuildLogoUrl(portalUrl);
        return $"""
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"/><title>{HtmlEnc(title)}</title></head>
            <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
              <span style="display:none;max-height:0;overflow:hidden;">{HtmlEnc(preheader)}</span>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                    <tr><td style="background-color:#064e80;background:#064e80;padding:24px 36px;">
                      <img src="{logoSrc}" alt="ANDRITZ" height="22" style="display:block;height:22px;width:auto;border:0;outline:none;text-decoration:none;"/>
                      <p style="margin:8px 0 0;color:rgba(255,255,255,.6);font-size:10px;letter-spacing:.3em;text-transform:uppercase;line-height:1;">Supplier Connect</p>
                    </td></tr>
                    <tr><td style="padding:32px 36px;color:#374151;font-size:14px;line-height:1.6;">{html}{actions}</td></tr>
                    <tr><td style="background:#f8f9fa;padding:20px 36px;border-top:1px solid #e9ecef;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;">Automated notification from the Andritz Supplier Connect portal. Do not reply.</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body></html>
            """;
    }

    private static string BuildLogoUrl(string? portalUrl)
    {
        // Fall back to the production domain when no portalUrl is configured.
        // Outlook downloads PNG/SVG from absolute https URLs but strips inline
        // data: URIs and SVGs, so we must reference a hosted asset.
        var baseUrl = string.IsNullOrWhiteSpace(portalUrl)
            ? "https://andritz-vendor-portal-production.up.railway.app"
            : portalUrl.TrimEnd('/');
        return $"{baseUrl}/andritz-logo-white.svg";
    }

    /// <summary>
    /// Builds the standard approval-action footer (Approve / Reject / View in Portal).
    /// Handlers call this once and pass the result to <see cref="IEmailTemplateService"/>
    /// so the visible buttons stay outside the admin-editable body.
    /// </summary>
    public static string BuildActionFooter(string? approveUrl, string? rejectUrl, string portalUrl, string portalLabel)
    {
        if (approveUrl is null && rejectUrl is null)
        {
            return $"""<div style="margin-top:24px;"><a href="{portalUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 28px;background:#096fb3;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">{HtmlEnc(portalLabel)}</a></div>""";
        }

        var sb = new StringBuilder();
        sb.Append("""<div style="margin-top:24px;">""");
        if (approveUrl is not null)
            sb.Append($"""<a href="{approveUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 28px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Approve</a>""");
        if (rejectUrl is not null)
            sb.Append($"""<a href="{rejectUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 28px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">Reject</a>""");
        sb.Append($"""<a href="{portalUrl}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 28px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">{HtmlEnc(portalLabel)}</a>""");
        sb.Append("</div>");
        sb.Append("""<p style="margin:12px 0 0;color:#9ca3af;font-size:11px;">Approve/Reject links are valid for 7 days and can be used once.</p>""");
        return sb.ToString();
    }

    private static string FormatBody(string plain)
    {
        if (string.IsNullOrEmpty(plain)) return string.Empty;

        var sb = new StringBuilder();
        var paragraphs = plain.Replace("\r\n", "\n").Split("\n\n", StringSplitOptions.None);

        foreach (var raw in paragraphs)
        {
            var para = raw.Trim('\n');
            if (string.IsNullOrWhiteSpace(para)) continue;

            var lines = para.Split('\n').Where(l => l.Length > 0).ToArray();

            // Split the paragraph into a leading non-bullet "header" section
            // (e.g. "Request Details:") and a trailing run of bullet lines.
            // This lets us render the bullets as a table even when the
            // template author put a heading line right above them without a
            // blank line separating the two blocks.
            var firstBulletIdx = -1;
            for (int i = 0; i < lines.Length; i++)
            {
                if (lines[i].TrimStart().StartsWith("•")) { firstBulletIdx = i; break; }
            }
            var hasBullets = firstBulletIdx >= 0
                && lines.Skip(firstBulletIdx).All(l => l.TrimStart().StartsWith("•"));
            var headerLines = hasBullets ? lines.Take(firstBulletIdx).ToArray() : lines;
            var bulletLines = hasBullets ? lines.Skip(firstBulletIdx).ToArray() : Array.Empty<string>();

            if (headerLines.Length > 0)
            {
                sb.Append("<p style=\"margin:0 0 8px 0;\">");
                for (int i = 0; i < headerLines.Length; i++)
                {
                    sb.Append(HtmlEnc(headerLines[i]));
                    if (i < headerLines.Length - 1) sb.Append("<br/>");
                }
                sb.Append("</p>");
            }

            if (!hasBullets)
            {
                continue;
            }

            // If every bullet is a "Label: Value" pair, render it as a
            // two-column table so admins see the metadata as structured
            // info instead of a plain bulleted list.
            var pairs = new List<(string Label, string Value)>();
            var allPairs = true;
            foreach (var line in bulletLines)
            {
                var item = line.TrimStart().TrimStart('•').Trim();
                var idx = item.IndexOf(':');
                if (idx <= 0 || idx == item.Length - 1) { allPairs = false; break; }
                pairs.Add((item[..idx].Trim(), item[(idx + 1)..].Trim()));
            }

            if (allPairs)
            {
                sb.Append("<table cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;border-collapse:collapse;margin:0 0 16px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;\">");
                for (int i = 0; i < pairs.Count; i++)
                {
                    var (label, value) = pairs[i];
                    var rowBg = i % 2 == 0 ? "#f9fafb" : "#ffffff";
                    sb.Append($"<tr style=\"background:{rowBg};\">")
                      .Append($"<td style=\"padding:8px 12px;color:#6b7280;font-size:13px;font-weight:600;width:38%;vertical-align:top;border-bottom:1px solid #f1f5f9;\">{HtmlEnc(label)}</td>")
                      .Append($"<td style=\"padding:8px 12px;color:#111827;font-size:13px;vertical-align:top;border-bottom:1px solid #f1f5f9;\">{HtmlEnc(value)}</td>")
                      .Append("</tr>");
                }
                sb.Append("</table>");
            }
            else
            {
                sb.Append("<ul style=\"margin:0 0 16px 0;padding-left:18px;color:#374151;\">");
                foreach (var line in bulletLines)
                {
                    var item = line.TrimStart().TrimStart('•').Trim();
                    sb.Append("<li style=\"margin:4px 0;\">").Append(HtmlEnc(item)).Append("</li>");
                }
                sb.Append("</ul>");
            }
        }

        return sb.ToString();
    }

    private static string HtmlEnc(string s) => WebUtility.HtmlEncode(s);
}
