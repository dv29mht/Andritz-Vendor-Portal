using AndritzVendorPortal.API.DTOs;
using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(UserManager<ApplicationUser> userManager) : ControllerBase
{
    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/users/approvers
    // Returns all Approver-role users. Used by BuyerConsole dropdown.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("approvers")]
    [Authorize(Roles = $"{Roles.Buyer},{Roles.Admin}")]
    public async Task<IActionResult> GetApprovers()
    {
        var approvers = await userManager.GetUsersInRoleAsync(Roles.Approver);
        var result = approvers
            .Select(u => new { id = u.Id, name = u.FullName, email = u.Email })
            .OrderBy(u => u.name)
            .ToList();

        return Ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/users
    // Admin-only: returns every user with their assigned roles and designation.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetAll()
    {
        var users = await userManager.Users
            .OrderBy(u => u.FullName)
            .ToListAsync();

        var result = new List<UserDto>();
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            result.Add(new UserDto(
                user.Id,
                user.FullName,
                user.Email          ?? string.Empty,
                user.Designation,
                roles.ToList()));
        }

        return Ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/users
    // Admin-only: creates a new user account with an assigned role and optional designation.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        var validRoles = new[] { Roles.Admin, Roles.Buyer, Roles.Approver, Roles.FinalApprover };
        if (!validRoles.Contains(dto.Role))
            return BadRequest($"Invalid role. Must be one of: {string.Join(", ", validRoles)}.");

        // Enforce corporate domain — all accounts must use the @andritz.com address.
        if (!dto.Email.EndsWith("@andritz.com", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Email address must use the @andritz.com domain.");

        if (await userManager.FindByEmailAsync(dto.Email) is not null)
            return Conflict("A user with this email address already exists.");

        var user = new ApplicationUser
        {
            UserName       = dto.Email,
            Email          = dto.Email,
            FullName       = dto.FullName,
            Designation    = dto.Designation ?? string.Empty,
            EmailConfirmed = true,
        };

        var result = await userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description).ToList());

        await userManager.AddToRoleAsync(user, dto.Role);

        return Ok(new UserDto(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            user.Designation,
            [dto.Role]));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/users/sync-ad
    // Placeholder for future Azure AD synchronisation (BRD future scope).
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("sync-ad")]
    [Authorize(Roles = Roles.Admin)]
    public IActionResult SyncFromAd()
    {
        return Ok(new
        {
            message  = "Azure AD sync is not yet configured. This feature is planned for a future release.",
            syncedAt = DateTime.UtcNow,
        });
    }
}
