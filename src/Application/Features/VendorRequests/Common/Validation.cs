namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

internal static class ValidationPatterns
{
    /// <summary>15-char Indian GST format (e.g. 22AAAAA0000A1Z5).</summary>
    public const string Gst = @"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$";

    /// <summary>10-char Indian PAN format (e.g. ABCDE1234F).</summary>
    public const string Pan = @"^[A-Z]{5}[0-9]{4}[A-Z]$";

    public const string GstError = "GST number must be in the format 22AAAAA0000A1Z5 (15 characters).";
    public const string PanError = "PAN card must be in the format ABCDE1234F (10 characters).";
    public const string VendorCodeError = "Vendor code must be 1–10 digits.";
    public const string VendorCode = @"^\d{1,10}$";
}
