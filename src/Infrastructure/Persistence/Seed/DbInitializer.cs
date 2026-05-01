using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AndritzVendorPortal.Infrastructure.Persistence.Seed;

public static class DbInitializer
{
    /// <summary>
    /// Applies pending EF Core migrations and seeds roles plus the two system accounts
    /// (Final Approver and Admin). Safe to call on every startup.
    /// </summary>
    public static async Task InitializeAsync(
        ApplicationDbContext db,
        UserManager<ApplicationUser> users,
        RoleManager<IdentityRole> roles,
        ILogger logger,
        string defaultAdminPassword)
    {
        try
        {
            await db.Database.MigrateAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Seed] Migration failed");
            throw;
        }

        foreach (var role in Roles.All)
        {
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));
        }

        await EnsureUserAsync(users, logger,
            email: SystemAccounts.AdminEmail,
            fullName: "Andritz Admin",
            designation: "Administrator",
            password: defaultAdminPassword,
            role: Roles.Admin);

        await EnsureUserAsync(users, logger,
            email: SystemAccounts.FinalApproverEmail,
            fullName: "Pardeep Sharma",
            designation: "Final Approver",
            password: defaultAdminPassword,
            role: Roles.FinalApprover);
    }

    private static async Task EnsureUserAsync(
        UserManager<ApplicationUser> users,
        ILogger logger,
        string email, string fullName, string designation, string password, string role)
    {
        var existing = await users.FindByEmailAsync(email);
        if (existing is not null)
        {
            if (!await users.IsInRoleAsync(existing, role))
                await users.AddToRoleAsync(existing, role);
            return;
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FullName = fullName,
            Designation = designation
        };
        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            logger.LogError("[Seed] Failed to create {Email}: {Errors}",
                email, string.Join(", ", result.Errors.Select(e => e.Description)));
            return;
        }
        await users.AddToRoleAsync(user, role);
    }
}
