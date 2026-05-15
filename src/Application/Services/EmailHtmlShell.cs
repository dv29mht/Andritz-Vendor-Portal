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
    // The brand "A" letter taken from AndritzVendorPortal.Frontend/public/andritz-logo.svg
    // (the same wordmark used in the side nav and login screen) — rendered white
    // so it sits cleanly on the dark-blue email header. Embedded as a data URI
    // so the header renders with no external asset fetch, and uses the
    // brand-correct letterform rather than the stylized favicon glyph.
    private const string FaviconDataUri =
        "data:image/svg+xml;utf8," +
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 76 100' fill='white'>" +
        "<polygon points='0,95 18,95 38,20 58,95 76,95 50,5 26,5'/>" +
        "<polygon points='22,65 54,65 50,52 26,52'/>" +
        "</svg>";

    public static string Wrap(string title, string preheader, string plainBody, string? actionFooterHtml = null)
    {
        var html = FormatBody(plainBody);
        var actions = string.IsNullOrWhiteSpace(actionFooterHtml) ? string.Empty : actionFooterHtml;
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
                      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding-right:14px;vertical-align:middle;width:34px;">
                            <img src="{FaviconDataUri}" alt="Andritz Supplier Connect" width="34" height="44" style="display:block;width:34px;height:44px;border:0;outline:none;text-decoration:none;"/>
                          </td>
                          <td style="vertical-align:middle;">
                            <p style="margin:0;color:#fff;font-weight:900;font-size:22px;letter-spacing:.18em;line-height:1;">ANDRITZ</p>
                            <p style="margin:4px 0 0;color:rgba(255,255,255,.6);font-size:11px;letter-spacing:.3em;text-transform:uppercase;line-height:1;">Vendor Onboarding &amp; Compliance</p>
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                    <tr><td style="padding:32px 36px;color:#374151;font-size:14px;line-height:1.6;">{html}{actions}</td></tr>
                    <tr><td style="background:#f8f9fa;padding:20px 36px;border-top:1px solid #e9ecef;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;">Automated notification from the Andritz Vendor Portal. Do not reply.</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body></html>
            """;
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

            var lines = para.Split('\n');
            var bulletBlock = lines.Length > 0 && lines.All(l => l.TrimStart().StartsWith("•"));

            if (bulletBlock)
            {
                sb.Append("<ul style=\"margin:0 0 16px 0;padding-left:18px;color:#374151;\">");
                foreach (var line in lines)
                {
                    var item = line.TrimStart().TrimStart('•').Trim();
                    sb.Append("<li style=\"margin:4px 0;\">").Append(HtmlEnc(item)).Append("</li>");
                }
                sb.Append("</ul>");
            }
            else
            {
                sb.Append("<p style=\"margin:0 0 16px 0;\">");
                for (int i = 0; i < lines.Length; i++)
                {
                    sb.Append(HtmlEnc(lines[i]));
                    if (i < lines.Length - 1) sb.Append("<br/>");
                }
                sb.Append("</p>");
            }
        }

        return sb.ToString();
    }

    private static string HtmlEnc(string s) => WebUtility.HtmlEncode(s);
}
