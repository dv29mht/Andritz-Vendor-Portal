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

        // Call MigrateAsync directly with retry. Earlier versions of this
        // method opened a probe connection first, but the probe used the full
        // connection string (Database=AndritzVendorPortal) which fails on a
        // fresh server with "Login failed for user 'sa'. Reason: Failed to
        // open the explicitly specified database" — the target DB doesn't
        // exist yet, and only MigrateAsync knows how to bootstrap it (it
        // connects to master first to issue CREATE DATABASE).
        //
        // 60 attempts × 2s sleep = ~2-3 minutes of patience. Warm restarts
        // succeed on the first attempt; cold-server first-boots eat 15-30s
        // worth of failed attempts while MSSQL completes its template-DB
        // upgrades, then succeed.
        const int maxAttempts = 60;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                logger.LogInformation("[Seed] Applying migrations (attempt {Attempt}/{Max})", attempt, maxAttempts);
                using var migrateCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
                await db.Database.MigrateAsync(migrateCts.Token);
                logger.LogInformation("[Seed] Migrations applied");
                break;
            }
            catch (Exception ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(
                    "[Seed] Migration attempt {Attempt}/{Max} failed: {Message}; retrying in 2s",
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

        // Single elevated account: the Final Approver now holds every former admin
        // capability (the Admin role was collapsed into FinalApprover).
        await EnsureUserAsync(users, logger,
            email: SystemAccounts.FinalApproverEmail,
            fullName: "Pardeep Sharma",
            designation: "Final Approver",
            password: defaultAdminPassword,
            role: Roles.FinalApprover);

        // Decommission the legacy admin@andritz.com login if it still exists, so it
        // can't authenticate into a now role-less, blank app. Reversible: the account
        // and its data are retained, just archived with its roles stripped.
        await ArchiveLegacyAdminAsync(users, logger);

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

    // Bulletproof, idempotent repair of a seeded system account. Runs on every
    // startup and *unconditionally* snaps the account back to a usable state:
    // unlocks it, unarchives it, confirms the email, force-resets the password
    // to the configured seed value, and re-adds the role. This is the
    // emergency-recovery escape hatch — if anyone gets locked out, can't log
    // in, or the password hash drifts (manual SQL, half-baked admin reset,
    // hash-algorithm upgrade), restart the app and the seeded credentials are
    // guaranteed valid again. Logs every action so the prod log file is
    // self-diagnosing without DB access.
    private static async Task EnsureUserAsync(
        UserManager<ApplicationUser> users,
        ILogger logger,
        string email, string fullName, string designation, string password, string role)
    {
        var existing = await users.FindByEmailAsync(email);
        if (existing is null)
        {
            var user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                FullName = fullName,
                Designation = designation
            };
            var create = await users.CreateAsync(user, password);
            if (!create.Succeeded)
            {
                logger.LogError("[Seed] CREATE failed for {Email}: {Errors}",
                    email, string.Join(", ", create.Errors.Select(e => e.Description)));
                return;
            }
            var roleAdd = await users.AddToRoleAsync(user, role);
            logger.LogInformation(
                "[Seed] Created {Email} in role {Role} (roleAdd={RoleSucceeded})",
                email, role, roleAdd.Succeeded);
            return;
        }

        var changes = new List<string>();

        if (existing.IsArchived)              { existing.IsArchived = false;         changes.Add("unarchived"); }
        if (!existing.EmailConfirmed)         { existing.EmailConfirmed = true;      changes.Add("email-confirmed"); }
        if (existing.LockoutEnd is not null)  { existing.LockoutEnd = null;          changes.Add("lockout-cleared"); }
        if (existing.AccessFailedCount != 0)  { existing.AccessFailedCount = 0;      changes.Add("fail-count-reset"); }
        if (!string.Equals(existing.FullName, fullName, StringComparison.Ordinal))
            { existing.FullName = fullName; changes.Add("fullname-updated"); }

        if (changes.Count > 0)
        {
            var update = await users.UpdateAsync(existing);
            if (!update.Succeeded)
            {
                logger.LogError("[Seed] UpdateAsync failed for {Email}: {Errors}",
                    email, string.Join(", ", update.Errors.Select(e => e.Description)));
            }
        }

        if (!await users.IsInRoleAsync(existing, role))
        {
            var roleAdd = await users.AddToRoleAsync(existing, role);
            changes.Add(roleAdd.Succeeded ? $"role-added:{role}" : $"role-add-FAILED:{role}");
        }

        // Force-reset password every boot regardless of whether the existing
        // hash matches. If it matches, this is a transparent no-op for the
        // user; if it has drifted, this restores it. Cheap insurance.
        var token = await users.GeneratePasswordResetTokenAsync(existing);
        var reset = await users.ResetPasswordAsync(existing, token, password);
        if (!reset.Succeeded)
        {
            logger.LogError("[Seed] FORCE-RESET password failed for {Email}: {Errors}",
                email, string.Join(", ", reset.Errors.Select(e => e.Description)));
        }
        else
        {
            changes.Add("password-force-reset");
        }

        // Final verification — re-fetch and confirm the password hash actually
        // accepts the seed password, so the log shows a definitive yes/no the
        // seeded credentials work right now.
        var verify = await users.FindByEmailAsync(email);
        var passwordOk = verify is not null && await users.CheckPasswordAsync(verify, password);
        logger.LogInformation(
            "[Seed] Repaired {Email}: changes=[{Changes}], roles=[{Roles}], " +
            "archived={Archived}, lockoutEnd={LockoutEnd}, failCount={FailCount}, " +
            "passwordCheck={PasswordOk}",
            email,
            changes.Count == 0 ? "none" : string.Join(", ", changes),
            verify is null ? "<missing>" : string.Join(",", await users.GetRolesAsync(verify)),
            verify?.IsArchived,
            verify?.LockoutEnd?.ToString("o") ?? "null",
            verify?.AccessFailedCount,
            passwordOk ? "OK" : "FAIL");
    }

    // Idempotently decommissions the legacy admin@andritz.com account now that the
    // Admin role no longer exists. Archives it and strips every role so it can't log
    // into a usable app. No-op once archived. Reversible (the row is retained).
    private static async Task ArchiveLegacyAdminAsync(
        UserManager<ApplicationUser> users, ILogger logger)
    {
        var legacy = await users.FindByEmailAsync(SystemAccounts.LegacyAdminEmail);
        if (legacy is null) return;

        var changes = new List<string>();

        var roles = await users.GetRolesAsync(legacy);
        if (roles.Count > 0)
        {
            var remove = await users.RemoveFromRolesAsync(legacy, roles);
            changes.Add(remove.Succeeded
                ? $"roles-removed:{string.Join(",", roles)}"
                : "role-remove-FAILED");
        }

        if (!legacy.IsArchived)
        {
            legacy.IsArchived = true;
            var update = await users.UpdateAsync(legacy);
            changes.Add(update.Succeeded ? "archived" : "archive-FAILED");
        }

        logger.LogInformation(
            "[Seed] Legacy admin {Email}: {Changes}",
            SystemAccounts.LegacyAdminEmail,
            changes.Count == 0 ? "already decommissioned" : string.Join(", ", changes));
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
