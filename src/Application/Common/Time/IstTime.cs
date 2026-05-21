using System.Globalization;

namespace AndritzVendorPortal.Application.Common.Time;

/// <summary>
/// Single source of truth for rendering UTC timestamps in Indian Standard Time
/// (UTC+5:30). All user-facing timestamps — email tokens, PDF exports, admin
/// audit notes — go through here so the portal never surfaces a UTC clock.
/// Storage and JSON serialization remain UTC; this helper is display-only.
/// </summary>
public static class IstTime
{
    // "India Standard Time" is the Windows ID; "Asia/Kolkata" is the IANA ID.
    // FindSystemTimeZoneById on .NET 8 accepts either on either OS, but we
    // fall back across both so the code is portable between Windows hosts and
    // Linux containers (Railway runs Linux).
    private static readonly TimeZoneInfo IstZone = ResolveIst();

    private static TimeZoneInfo ResolveIst()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("India Standard Time"); }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }
        return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
    }

    public static DateTime ToIst(DateTime utc)
    {
        var asUtc = utc.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(utc, DateTimeKind.Utc)
            : utc.ToUniversalTime();
        return TimeZoneInfo.ConvertTimeFromUtc(asUtc, IstZone);
    }

    /// <summary>"21 May 2026, 10:17 IST" — matches the existing email layout.</summary>
    public static string FormatLong(DateTime utc) =>
        ToIst(utc).ToString("dd MMM yyyy, HH:mm 'IST'", CultureInfo.InvariantCulture);

    /// <summary>"2026-05-21 10:17 IST" — matches the existing PDF layout.</summary>
    public static string FormatIso(DateTime utc) =>
        ToIst(utc).ToString("yyyy-MM-dd HH:mm 'IST'", CultureInfo.InvariantCulture);
}
