namespace AndritzVendorPortal.Domain.Constants;

public static class Roles
{
    // The Admin role was collapsed into FinalApprover: there is now a single
    // elevated account (the Final Approver) that also holds every former admin
    // capability. No separate Admin role exists.
    public const string Buyer = "Buyer";
    public const string Approver = "Approver";
    public const string FinalApprover = "FinalApprover";

    public static readonly string[] All = [Buyer, Approver, FinalApprover];

    // Roles the elevated user may assign to NEW accounts. Deliberately excludes
    // FinalApprover so a second elevated account can never be minted from the UI —
    // the single-elevated-account invariant is what keeps the FinalApprover email
    // guard (defense-in-depth on /complete) meaningful.
    public static readonly string[] AssignableByAdmin = [Buyer, Approver];
}

public static class Policies
{
    public const string FinalApproverOnly = "FinalApproverOnly";
}

public static class SystemAccounts
{
    public const string FinalApproverEmail = "pardeep.sharma@andritz.com";

    // Legacy Admin login, retained only so seeding can archive it on boot now
    // that the Admin role no longer exists.
    public const string LegacyAdminEmail = "admin@andritz.com";
}
