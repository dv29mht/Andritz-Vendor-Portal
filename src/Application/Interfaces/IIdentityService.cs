using AndritzVendorPortal.Application.DTOs;

namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Abstraction over ASP.NET Identity for user/role management.
/// Application handlers depend on this — Infrastructure provides the EF-backed implementation.
/// </summary>
public interface IIdentityService
{
    Task<UserInfoDto?> FindByIdAsync(string userId);
    Task<UserInfoDto?> FindByEmailAsync(string email);
    Task<bool> CheckPasswordAsync(string email, string password);
    Task<bool> IsLockedOutAsync(string email);
    Task<IReadOnlyList<string>> GetRolesAsync(string userId);
    Task<IReadOnlyList<UserInfoDto>> GetAllUsersAsync(bool includeArchived = false);
    Task<IReadOnlyList<UserInfoDto>> GetUsersInRoleAsync(string role);
    Task<(bool Succeeded, string UserId, IReadOnlyList<string> Errors)> CreateUserAsync(
        string email, string password, string fullName, string? designation, string role);
    Task<(bool Succeeded, IReadOnlyList<string> Errors)> UpdateUserAsync(
        string userId, string fullName, string email, string? designation, string role, string? newPassword);
    Task<(bool Succeeded, IReadOnlyList<string> Errors)> UpdateProfileAsync(
        string userId, string fullName, string? currentPassword, string? newPassword);
    Task<(bool Succeeded, IReadOnlyList<string> Errors)> ArchiveUserAsync(string userId);
    Task<(bool Succeeded, IReadOnlyList<string> Errors)> RestoreUserAsync(string userId);
    Task<(bool Succeeded, IReadOnlyList<string> Errors)> PurgeUserAsync(string userId);
    Task<string> GeneratePasswordResetTokenAsync(string email);
    Task<(bool Succeeded, IReadOnlyList<string> Errors)> ResetPasswordAsync(string email, string token, string newPassword);
    Task PropagateUserNameChangeAsync(string userId, string newFullName, CancellationToken ct = default);
}
