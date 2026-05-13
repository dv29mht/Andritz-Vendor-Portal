using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Features.VendorRequests.Commands;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Claims;

namespace AndritzVendorPortal.API.Controllers;

/// <summary>
/// Handles approve/reject actions triggered from email links. Anonymous endpoints —
/// auth is established by a signed, time-limited token embedded in the URL.
/// </summary>
[ApiController]
[Route("api/vendor-requests/email-action")]
[AllowAnonymous]
public class EmailActionController(
    IMediator mediator,
    IEmailActionTokenService tokens,
    IIdentityService identity,
    IHttpContextAccessor http,
    ILogger<EmailActionController> logger) : ControllerBase
{
    private const string ApproveAction = "approve";
    private const string RejectAction = "reject";

    [HttpGet("approve")]
    public async Task<IActionResult> Approve([FromQuery] string token, CancellationToken ct)
    {
        if (!tokens.TryValidate(token, out var payload, out var tokenError))
            return Html(ErrorPage("Invalid link", tokenError ?? "This approval link is invalid."));

        if (!string.Equals(payload.Action, ApproveAction, StringComparison.OrdinalIgnoreCase))
            return Html(ErrorPage("Invalid link", "This link is not an approval link."));

        var impersonationError = await ImpersonateAsync(payload.UserId);
        if (impersonationError is not null)
            return Html(ErrorPage("Account unavailable", impersonationError));

        try
        {
            var dto = await mediator.Send(new ApproveVendorRequestCommand(payload.VendorRequestId, null), ct);
            return Html(SuccessPage(
                "Approval recorded",
                $"You have approved <strong>{WebUtility.HtmlEncode(dto.VendorName)}</strong> (Request #{dto.Id}).",
                "The request has moved to the next stage of the workflow."));
        }
        catch (ForbiddenException)
        {
            return Html(InfoPage("Already acted",
                "This approval step has already been completed — either by you in another session, or by an admin override. No further action is needed."));
        }
        catch (BadRequestException ex)
        {
            return Html(InfoPage("Cannot approve", ex.Message));
        }
        catch (NotFoundException)
        {
            return Html(ErrorPage("Request not found", "The vendor request referenced by this link no longer exists."));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[EmailAction] Approve failed for token");
            return Html(ErrorPage("Something went wrong",
                "We could not record your approval. Please open the portal and try again."));
        }
    }

    [HttpGet("reject")]
    public async Task<IActionResult> RejectForm([FromQuery] string token)
    {
        if (!tokens.TryValidate(token, out var payload, out var tokenError))
            return Html(ErrorPage("Invalid link", tokenError ?? "This rejection link is invalid."));

        if (!string.Equals(payload.Action, RejectAction, StringComparison.OrdinalIgnoreCase))
            return Html(ErrorPage("Invalid link", "This link is not a rejection link."));

        var user = await identity.FindByIdAsync(payload.UserId);
        var who = user?.FullName ?? "Approver";
        return Html(RejectFormPage(token, payload.VendorRequestId, who));
    }

    [HttpPost("reject")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> RejectSubmit([FromForm] string token, [FromForm] string comment, CancellationToken ct)
    {
        if (!tokens.TryValidate(token, out var payload, out var tokenError))
            return Html(ErrorPage("Invalid link", tokenError ?? "This rejection link is invalid."));

        if (!string.Equals(payload.Action, RejectAction, StringComparison.OrdinalIgnoreCase))
            return Html(ErrorPage("Invalid link", "This link is not a rejection link."));

        if (string.IsNullOrWhiteSpace(comment))
            return Html(RejectFormPage(token, payload.VendorRequestId, "Approver",
                "A rejection comment is required."));

        if (comment.Length > 500)
            return Html(RejectFormPage(token, payload.VendorRequestId, "Approver",
                "Rejection comment must be 500 characters or fewer."));

        var impersonationError = await ImpersonateAsync(payload.UserId);
        if (impersonationError is not null)
            return Html(ErrorPage("Account unavailable", impersonationError));

        try
        {
            var dto = await mediator.Send(new RejectVendorRequestCommand(payload.VendorRequestId, comment), ct);
            return Html(SuccessPage(
                "Rejection recorded",
                $"You have rejected <strong>{WebUtility.HtmlEncode(dto.VendorName)}</strong> (Request #{dto.Id}).",
                "The buyer has been notified and can now revise the request."));
        }
        catch (ForbiddenException)
        {
            return Html(InfoPage("Already acted",
                "This step has already been completed — no further action is needed."));
        }
        catch (BadRequestException ex)
        {
            return Html(InfoPage("Cannot reject", ex.Message));
        }
        catch (NotFoundException)
        {
            return Html(ErrorPage("Request not found", "The vendor request referenced by this link no longer exists."));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[EmailAction] Reject failed for token");
            return Html(ErrorPage("Something went wrong",
                "We could not record your rejection. Please open the portal and try again."));
        }
    }

    private async Task<string?> ImpersonateAsync(string userId)
    {
        var user = await identity.FindByIdAsync(userId);
        if (user is null || user.IsArchived)
            return "This user account is no longer active.";

        var roles = await identity.GetRolesAsync(userId);
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email),
            new("name", user.FullName)
        };
        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var identity_ = new ClaimsIdentity(claims, authenticationType: "EmailAction");
        var principal = new ClaimsPrincipal(identity_);

        var ctx = http.HttpContext;
        if (ctx is not null)
            ctx.User = principal;

        return null;
    }

    private ContentResult Html(string body) =>
        new() { Content = body, ContentType = "text/html; charset=utf-8", StatusCode = 200 };

    // ── Branded HTML pages ──────────────────────────────────────────────────

    private static string Shell(string title, string accent, string innerHtml) => $"""
        <!DOCTYPE html>
        <html lang="en"><head><meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>{WebUtility.HtmlEncode(title)} · Andritz Vendor Portal</title></head>
        <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;min-height:100vh;">
          <div style="max-width:560px;margin:48px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
            <div style="background:#064e80;padding:28px 36px;">
              <p style="margin:0;color:#fff;font-weight:900;font-size:22px;letter-spacing:.18em;">ANDRITZ</p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,.6);font-size:11px;letter-spacing:.3em;text-transform:uppercase;">Vendor Onboarding &amp; Compliance</p>
            </div>
            <div style="height:4px;background:{accent};"></div>
            <div style="padding:32px 36px;">{innerHtml}</div>
            <div style="background:#f8f9fa;padding:16px 36px;border-top:1px solid #e9ecef;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">Automated action from the Andritz Vendor Portal.</p>
            </div>
          </div>
        </body></html>
        """;

    private static string SuccessPage(string title, string lead, string sub) =>
        Shell(title, "#10b981", $"""
            <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">{WebUtility.HtmlEncode(title)}</h1>
            <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.5;">{lead}</p>
            <p style="margin:0;color:#6b7280;font-size:13px;">{WebUtility.HtmlEncode(sub)}</p>
            """);

    private static string InfoPage(string title, string lead) =>
        Shell(title, "#f59e0b", $"""
            <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">{WebUtility.HtmlEncode(title)}</h1>
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.5;">{WebUtility.HtmlEncode(lead)}</p>
            """);

    private static string ErrorPage(string title, string lead) =>
        Shell(title, "#ef4444", $"""
            <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">{WebUtility.HtmlEncode(title)}</h1>
            <p style="margin:0;color:#374151;font-size:15px;line-height:1.5;">{WebUtility.HtmlEncode(lead)}</p>
            """);

    private static string RejectFormPage(string token, int requestId, string who, string? error = null)
    {
        var errBlock = error is null ? "" :
            $"""<div style="margin:0 0 16px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-size:13px;">{WebUtility.HtmlEncode(error)}</div>""";
        return Shell("Reject Vendor Request", "#ef4444", $"""
            <h1 style="margin:0 0 6px;color:#111827;font-size:22px;">Reject vendor request #{requestId}</h1>
            <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Acting as <strong>{WebUtility.HtmlEncode(who)}</strong>. Provide a reason — this will be visible to the buyer.</p>
            {errBlock}
            <form method="POST" action="/api/vendor-requests/email-action/reject">
              <input type="hidden" name="token" value="{WebUtility.HtmlEncode(token)}"/>
              <label for="c" style="display:block;margin-bottom:6px;color:#374151;font-size:13px;font-weight:600;">Rejection comment (required, max 500 chars)</label>
              <textarea id="c" name="comment" rows="5" maxlength="500" required
                style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-family:inherit;font-size:14px;resize:vertical;"></textarea>
              <div style="margin-top:18px;">
                <button type="submit"
                  style="display:inline-block;padding:12px 28px;background:#ef4444;color:#fff;border:0;border-radius:6px;font-weight:600;font-size:14px;cursor:pointer;">
                  Confirm Rejection
                </button>
              </div>
            </form>
            """);
    }
}
