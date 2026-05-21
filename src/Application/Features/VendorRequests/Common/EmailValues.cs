using AndritzVendorPortal.Application.Common.Time;
using AndritzVendorPortal.Domain.Entities;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

/// <summary>
/// Builds the placeholder dictionary expected by IEmailTemplateService.
/// One source of truth for token names — handlers don't repeat magic strings.
/// </summary>
internal static class EmailValues
{
    public static Dictionary<string, string?> ForVendor(
        VendorRequest entity,
        DateTime utcNow,
        string? recipientName = null,
        string? approverName = null,
        string? finalApproverName = null,
        string? buyerName = null,
        string? comments = null,
        string? intermediateApproverNames = null)
    {
        return new Dictionary<string, string?>
        {
            ["[Request ID]"]                        = entity.Id.ToString(),
            ["[Vendor Name]"]                       = entity.VendorName,
            ["[Vendor Code]"]                       = entity.VendorCode ?? string.Empty,
            ["[Date & Time]"]                       = FormatTimestamp(utcNow),
            ["[Revision Number]"]                   = entity.RevisionNo.ToString(),
            ["[Buyer Name]"]                        = buyerName ?? recipientName ?? entity.CreatedByName,
            ["[Approver Name]"]                     = approverName ?? recipientName ?? string.Empty,
            ["[Final Approver Name]"]               = finalApproverName ?? string.Empty,
            ["[Intermediate Approver Name(s)]"]     = intermediateApproverNames ?? string.Empty,
            ["[Comments]"]                          = comments ?? string.Empty,
        };
    }

    public static string FormatTimestamp(DateTime utc) => IstTime.FormatLong(utc);
}
