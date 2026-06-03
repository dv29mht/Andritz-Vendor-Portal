using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Infrastructure.Identity;

public class IdentityService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    ApplicationDbContext db) : IIdentityService
{
    public async Task<UserInfoDto?> FindByIdAsync(string userId)
    {
        var u = await userManager.FindByIdAsync(userId);
        return u is null ? null : Map(u);
    }

    public async Task<UserInfoDto?> FindByEmailAsync(string email)
    {
        var u = await userManager.FindByEmailAsync(email);
        return u is null ? null : Map(u);
    }

    public async Task<bool> CheckPasswordAsync(string email, string password)
    {
        var u = await userManager.FindByEmailAsync(email);
        if (u is null) return false;
        var result = await signInManager.CheckPasswordSignInAsync(u, password, lockoutOnFailure: true);
        return result.Succeeded;
    }

    public async Task<bool> IsLockedOutAsync(string email)
    {
        var u = await userManager.FindByEmailAsync(email);
        return u is not null && await userManager.IsLockedOutAsync(u);
    }

    public async Task<IReadOnlyList<string>> GetRolesAsync(string userId) =>
        // Single join instead of FindByIdAsync (loads the whole user row) followed by
        // GetRolesAsync (a second query) — this path runs on every login and list call.
        await (from ur in db.UserRoles
               join r in db.Roles on ur.RoleId equals r.Id
               where ur.UserId == userId
               select r.Name!)
              .ToListAsync();

    public async Task<IReadOnlyList<UserInfoDto>> GetAllUsersAsync(bool includeArchived = false) =>
        await userManager.Users
            .Where(u => includeArchived || !u.IsArchived)
            .Select(u => new UserInfoDto(u.Id, u.Email!, u.FullName, u.Designation, u.IsArchived))
            .ToListAsync();

    public async Task<IReadOnlyList<UserWithRolesDto>> GetUsersWithRolesAsync(bool includeArchived = false)
    {
        // Resolve every user's roles in a fixed number of queries (users + role names +
        // user-role links) rather than one round-trip per user.
        var users = await userManager.Users
            .Where(u => includeArchived || !u.IsArchived)
            .Select(u => new UserInfoDto(u.Id, u.Email!, u.FullName, u.Designation, u.IsArchived))
            .ToListAsync();

        var roleNameById = await db.Roles
            .Select(r => new { r.Id, r.Name })
            .ToDictionaryAsync(r => r.Id, r => r.Name ?? string.Empty);

        var rolesByUserId = (await db.UserRoles.ToListAsync())
            .GroupBy(ur => ur.UserId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g
                    .Select(ur => roleNameById.TryGetValue(ur.RoleId, out var name) ? name : null)
                    .Where(name => !string.IsNullOrEmpty(name))
                    .Select(name => name!)
                    .ToList());

        return users
            .Select(u => new UserWithRolesDto(
                u.Id, u.Email, u.FullName, u.Designation, u.IsArchived,
                rolesByUserId.TryGetValue(u.Id, out var roles) ? roles : []))
            .ToList();
    }

    public async Task<IReadOnlyList<UserInfoDto>> GetUsersInRoleAsync(string role)
    {
        var users = await userManager.GetUsersInRoleAsync(role);
        return users.Select(Map).ToList();
    }

    public async Task<(bool Succeeded, string UserId, IReadOnlyList<string> Errors)> CreateUserAsync(
        string email, string password, string fullName, string? designation, string role)
    {
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = fullName,
            Designation = designation ?? string.Empty,
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            return (false, string.Empty, result.Errors.Select(e => e.Description).ToList());

        var addRole = await userManager.AddToRoleAsync(user, role);
        if (!addRole.Succeeded)
        {
            // Don't leave a role-less orphan behind — roll back the just-created user.
            await userManager.DeleteAsync(user);
            return (false, string.Empty, addRole.Errors.Select(e => e.Description).ToList());
        }

        return (true, user.Id, []);
    }

    public async Task<(bool Succeeded, IReadOnlyList<string> Errors)> UpdateUserAsync(
        string userId, string fullName, string email, string? designation, string role, string? newPassword)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return (false, ["User not found."]);

        user.FullName = fullName;
        user.Designation = designation ?? string.Empty;

        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            user.Email = email;
            user.UserName = email;
            user.NormalizedEmail = email.ToUpperInvariant();
            user.NormalizedUserName = email.ToUpperInvariant();
        }

        var update = await userManager.UpdateAsync(user);
        if (!update.Succeeded)
            return (false, update.Errors.Select(e => e.Description).ToList());

        // Swap roles add-first-then-remove so a failure can never leave the user with
        // zero roles (which would 403 them out of every [Authorize(Roles=…)] endpoint).
        var current = await userManager.GetRolesAsync(user);
        if (!current.Contains(role))
        {
            var add = await userManager.AddToRoleAsync(user, role);
            if (!add.Succeeded)
                return (false, add.Errors.Select(e => e.Description).ToList());
        }

        var toRemove = current.Where(r => !string.Equals(r, role, StringComparison.OrdinalIgnoreCase)).ToList();
        if (toRemove.Count > 0)
        {
            var remove = await userManager.RemoveFromRolesAsync(user, toRemove);
            if (!remove.Succeeded)
                return (false, remove.Errors.Select(e => e.Description).ToList());
        }

        if (!string.IsNullOrWhiteSpace(newPassword))
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);
            var pw = await userManager.ResetPasswordAsync(user, token, newPassword);
            if (!pw.Succeeded)
                return (false, pw.Errors.Select(e => e.Description).ToList());
        }

        return (true, []);
    }

    public async Task<(bool Succeeded, IReadOnlyList<string> Errors)> UpdateProfileAsync(
        string userId, string fullName, string? currentPassword, string? newPassword)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return (false, ["User not found."]);

        user.FullName = fullName;
        var update = await userManager.UpdateAsync(user);
        if (!update.Succeeded)
            return (false, update.Errors.Select(e => e.Description).ToList());

        if (!string.IsNullOrWhiteSpace(currentPassword) && !string.IsNullOrWhiteSpace(newPassword))
        {
            var pw = await userManager.ChangePasswordAsync(user, currentPassword, newPassword);
            if (!pw.Succeeded)
                return (false, pw.Errors.Select(e => e.Description).ToList());
        }

        return (true, []);
    }

    public async Task<(bool Succeeded, IReadOnlyList<string> Errors)> ArchiveUserAsync(string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return (false, ["User not found."]);
        user.IsArchived = true;
        var result = await userManager.UpdateAsync(user);
        return (result.Succeeded, result.Errors.Select(e => e.Description).ToList());
    }

    public async Task<(bool Succeeded, IReadOnlyList<string> Errors)> RestoreUserAsync(string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return (false, ["User not found."]);
        user.IsArchived = false;
        var result = await userManager.UpdateAsync(user);
        return (result.Succeeded, result.Errors.Select(e => e.Description).ToList());
    }

    public async Task<(bool Succeeded, IReadOnlyList<string> Errors)> PurgeUserAsync(string userId)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return (false, ["User not found."]);
        var result = await userManager.DeleteAsync(user);
        return (result.Succeeded, result.Errors.Select(e => e.Description).ToList());
    }

    public async Task<string> GeneratePasswordResetTokenAsync(string email)
    {
        var user = await userManager.FindByEmailAsync(email)
            ?? throw new InvalidOperationException("User not found.");
        return await userManager.GeneratePasswordResetTokenAsync(user);
    }

    public async Task<(bool Succeeded, IReadOnlyList<string> Errors)> ResetPasswordAsync(
        string email, string token, string newPassword)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null) return (false, ["Invalid request."]);
        var result = await userManager.ResetPasswordAsync(user, token, newPassword);
        return (result.Succeeded, result.Errors.Select(e => e.Description).ToList());
    }

    public async Task PropagateUserNameChangeAsync(string userId, string newFullName, CancellationToken ct = default)
    {
        // Ignore the soft-delete filter — a rename must reach archived requests too.
        await db.VendorRequests
            .IgnoreQueryFilters()
            .Where(r => r.CreatedByUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CreatedByName, newFullName), ct);
        await db.VendorRevisions
            .Where(v => v.ChangedByUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.ChangedByName, newFullName), ct);
        await db.ApprovalSteps
            .Where(a => a.ApproverUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ApproverName, newFullName), ct);
    }

    private static UserInfoDto Map(ApplicationUser u) =>
        new(u.Id, u.Email ?? string.Empty, u.FullName, u.Designation, u.IsArchived);
}
