using Microsoft.AspNetCore.Identity;

namespace AndritzVendorPortal.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;
    public bool IsArchived { get; set; } = false;
}
