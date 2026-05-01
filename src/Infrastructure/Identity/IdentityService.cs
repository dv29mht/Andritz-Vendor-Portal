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

    public async Task<IReadOnlyList<string>> GetRolesAsync(string userId)
    {
        var u = await userManager.FindByIdAsync(userId);
        return u is null ? [] : (await userManager.GetRolesAsync(u)).ToList();
    }

    public async Task<IReadOnlyList<UserInfoDto>> GetAllUsersAsync(bool includeArchived = false) =>
        await userManager.Users
            .Where(u => includeArchived || !u.IsArchived)
            .Select(u => new UserInfoDto(u.Id, u.Email!, u.FullName, u.Designation, u.IsArchived))
            .ToListAsync();

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

        await userManager.AddToRoleAsync(user, role);
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

        var current = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, current);
        await userManager.AddToRoleAsync(user, role);

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
        await db.VendorRequests
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
