namespace AndritzVendorPortal.Domain.Constants;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Buyer = "Buyer";
    public const string Approver = "Approver";
    public const string FinalApprover = "FinalApprover";

    public static readonly string[] All = [Admin, Buyer, Approver, FinalApprover];
    public static readonly string[] AssignableByAdmin = [Admin, Buyer, Approver];
}

public static class Policies
{
    public const string FinalApproverOnly = "FinalApproverOnly";
}

public static class SystemAccounts
{
    public const string FinalApproverEmail = "pardeep.sharma@yopmail.com";
    public const string AdminEmail = "adminandritz@yopmail.com";
}
