using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

/// <summary>
/// Centralised URL builders + PDF attachment wrapper for approval-stage emails.
/// Keeps token + URL formatting out of every handler.
/// </summary>
public static class EmailActionLinks
{
    public static string ApiBaseUrl(IConfiguration config) =>
        config["ApiBaseUrl"] ?? config["PortalUrl"] ?? "http://localhost:5173";

    public static (string ApproveUrl, string RejectUrl) BuildFor(
        IEmailActionTokenService tokens, IConfiguration config,
        VendorRequest request, ApprovalStep step)
    {
        var baseUrl = ApiBaseUrl(config).TrimEnd('/');
        var approveToken = tokens.Generate(request.Id, step.Id, step.ApproverUserId, "approve");
        var rejectToken = tokens.Generate(request.Id, step.Id, step.ApproverUserId, "reject");
        return (
            $"{baseUrl}/api/vendor-requests/email-action/approve?token={Uri.EscapeDataString(approveToken)}",
            $"{baseUrl}/api/vendor-requests/email-action/reject?token={Uri.EscapeDataString(rejectToken)}"
        );
    }

    public static string BuildRejectOnly(
        IEmailActionTokenService tokens, IConfiguration config,
        VendorRequest request, ApprovalStep step)
    {
        var baseUrl = ApiBaseUrl(config).TrimEnd('/');
        var rejectToken = tokens.Generate(request.Id, step.Id, step.ApproverUserId, "reject");
        return $"{baseUrl}/api/vendor-requests/email-action/reject?token={Uri.EscapeDataString(rejectToken)}";
    }

    public static IReadOnlyList<EmailAttachment> PdfAttachment(
        IVendorRequestPdfService pdfService, VendorRequest request)
    {
        var bytes = pdfService.Generate(request);
        var safeName = string.Join("_", request.VendorName.Split(System.IO.Path.GetInvalidFileNameChars()));
        if (string.IsNullOrWhiteSpace(safeName)) safeName = $"vendor-request-{request.Id}";
        return new[] { new EmailAttachment($"VendorRequest_{request.Id}_{safeName}.pdf", bytes) };
    }
}
