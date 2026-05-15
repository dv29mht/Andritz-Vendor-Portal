using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
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
        // Wait for the MySQL server to accept connections (helps when the app
        // and the DB container start at the same time on a fresh machine),
        // then create the database and apply migrations. Pomelo's MigrateAsync
        // will issue CREATE DATABASE IF NOT EXISTS implicitly, so a brand-new
        // server only needs the user credentials — nothing else to set up.
        const int maxAttempts = 10;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.Database.MigrateAsync();
                break;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(ex,
                    "[Seed] Database not reachable yet (attempt {Attempt}/{Max}); retrying in 2s",
                    attempt, maxAttempts);
                await Task.Delay(TimeSpan.FromSeconds(2));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Seed] Migration failed after {Max} attempts", maxAttempts);
                throw;
            }
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

        await SeedEmailTemplatesAsync(db, logger);
    }

    private static async Task SeedEmailTemplatesAsync(ApplicationDbContext db, ILogger logger)
    {
        var existing = await db.EmailTemplates
            .Select(t => t.Code)
            .ToListAsync();
        var existingSet = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        var added = 0;
        foreach (var def in EmailTemplateDefaults.All)
        {
            if (existingSet.Contains(def.Code)) continue;
            db.EmailTemplates.Add(new EmailTemplate
            {
                Code = def.Code,
                Name = def.Name,
                Audience = def.Audience,
                Subject = def.Subject,
                BodyText = def.BodyText,
                DefaultSubject = def.Subject,
                DefaultBodyText = def.BodyText,
                Placeholders = def.Placeholders,
            });
            added++;
        }

        if (added > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("[Seed] Inserted {Count} email template(s).", added);
        }

        // Refresh DefaultSubject/DefaultBodyText if they ever drift from code-level
        // canonical values — admins can still customise Subject/BodyText freely.
        var templates = await db.EmailTemplates.ToListAsync();
        var dirty = false;
        foreach (var tpl in templates)
        {
            var def = EmailTemplateDefaults.All.FirstOrDefault(d => d.Code == tpl.Code);
            if (def is null) continue;
            if (tpl.DefaultSubject != def.Subject) { tpl.DefaultSubject = def.Subject; dirty = true; }
            if (tpl.DefaultBodyText != def.BodyText) { tpl.DefaultBodyText = def.BodyText; dirty = true; }
            if (tpl.Placeholders != def.Placeholders) { tpl.Placeholders = def.Placeholders; dirty = true; }
            if (tpl.Name != def.Name) { tpl.Name = def.Name; dirty = true; }
            if (tpl.Audience != def.Audience) { tpl.Audience = def.Audience; dirty = true; }
        }
        if (dirty) await db.SaveChangesAsync();
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

            if (!await users.CheckPasswordAsync(existing, password))
            {
                var token = await users.GeneratePasswordResetTokenAsync(existing);
                var reset = await users.ResetPasswordAsync(existing, token, password);
                if (!reset.Succeeded)
                {
                    logger.LogError("[Seed] Failed to reset password for {Email}: {Errors}",
                        email, string.Join(", ", reset.Errors.Select(e => e.Description)));
                }
                else
                {
                    logger.LogInformation("[Seed] Reset password for seeded account {Email}", email);
                }
            }
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
