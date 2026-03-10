using Microsoft.AspNetCore.Identity;

namespace AndritzVendorPortal.API.Models;

public class ApplicationUser : IdentityUser
{
    public string FullName    { get; set; } = string.Empty;
    public string Designation { get; set; } = string.Empty;

    // Navigation
    public ICollection<VendorRequest> CreatedRequests { get; set; } = [];
}
