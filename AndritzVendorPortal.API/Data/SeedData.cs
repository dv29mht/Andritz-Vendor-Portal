using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Identity;

namespace AndritzVendorPortal.API.Data;

public static class SeedData
{
    public static async Task InitialiseAsync(
        RoleManager<IdentityRole>    roleManager,
        UserManager<ApplicationUser> userManager)
    {
        await SeedRolesAsync(roleManager);
        await SeedUsersAsync(userManager);
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        string[] roles = [Roles.Admin, Roles.Buyer, Roles.Approver, Roles.FinalApprover];

        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    private static async Task SeedUsersAsync(UserManager<ApplicationUser> userManager)
    {
        // (email, fullName, password, role, designation)
        var accounts = new[]
        {
            (FinalApproverRequirement.AuthorizedEmail,
             "Pardeep Sharma", "Change@Me1!",    Roles.FinalApprover, "VP Procurement"),
            ("vikram.nair@andritz.com",
             "Vikram Nair",    "Buyer@123!",     Roles.Buyer,         "Purchase Officer"),
            ("rajesh.kumar@andritz.com",
             "Rajesh Kumar",   "Approver@123!",  Roles.Approver,      "Purchase Manager"),
            ("sunita.rao@andritz.com",
             "Sunita Rao",     "Admin@123!",     Roles.Admin,         "System Administrator"),
        };

        foreach (var (email, fullName, password, role, designation) in accounts)
        {
            var existing = await userManager.FindByEmailAsync(email);

            if (existing is null)
            {
                // First run — create the account
                var user = new ApplicationUser
                {
                    UserName       = email,
                    Email          = email,
                    FullName       = fullName,
                    Designation    = designation,
                    EmailConfirmed = true,
                };

                var result = await userManager.CreateAsync(user, password);
                if (!result.Succeeded)
                    throw new InvalidOperationException(
                        $"Failed to seed {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");

                await userManager.AddToRoleAsync(user, role);
            }
            else if (string.IsNullOrEmpty(existing.Designation))
            {
                // Subsequent run after migration — back-fill the designation for existing accounts
                existing.Designation = designation;
                await userManager.UpdateAsync(existing);
            }
        }
    }
}
