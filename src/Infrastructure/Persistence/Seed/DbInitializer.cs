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
        // Log where we're dialing — without the password — so production
        // deploy logs make it obvious if the connection string is pointing
        // at the wrong server (e.g. localhost fallback when the env var
        // ConnectionStrings__DefaultConnection isn't set).
        var safe = SafeConnectionString(db.Database.GetDbConnection().ConnectionString);
        logger.LogInformation("[Seed] Target DB connection: {ConnString}", safe);

        // Open the underlying DbConnection directly (instead of EF Core's
        // CanConnectAsync, which swallows the inner exception and just
        // returns false). This way the actual SqlException message —
        // login failed, network error, TLS handshake failure, "Cannot
        // open database X" — shows up verbatim in the deploy logs.
        const int maxAttempts = 10;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                logger.LogInformation("[Seed] Probing DB connectivity (attempt {Attempt}/{Max})", attempt, maxAttempts);
                var conn = db.Database.GetDbConnection();
                await conn.OpenAsync();
                await conn.CloseAsync();

                logger.LogInformation("[Seed] DB reachable — applying migrations");
                using var migrateCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
                await db.Database.MigrateAsync(migrateCts.Token);
                logger.LogInformation("[Seed] Migrations applied");
                break;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(ex,
                    "[Seed] Connect/migrate failed (attempt {Attempt}/{Max}): {Message}; retrying in 2s",
                    attempt, maxAttempts, ex.Message);
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

    // Returns the connection string with any "Password=..." segment masked,
    // so deploy logs can show which server/database/user we're dialing
    // without leaking the SA password.
    private static string SafeConnectionString(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return "<empty>";
        return System.Text.RegularExpressions.Regex.Replace(
            raw,
            @"(Password|Pwd)\s*=\s*[^;]*",
            "$1=***",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }
}
