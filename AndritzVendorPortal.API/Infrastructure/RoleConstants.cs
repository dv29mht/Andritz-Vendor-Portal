namespace AndritzVendorPortal.API.Infrastructure;

public static class Roles
{
    public const string Admin         = "Admin";
    public const string Buyer         = "Buyer";
    public const string Approver      = "Approver";
    public const string FinalApprover = "FinalApprover";
}

public static class Policies
{
    public const string FinalApproverOnly = "FinalApproverOnly";
}
