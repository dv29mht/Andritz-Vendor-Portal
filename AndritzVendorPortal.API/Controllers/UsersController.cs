using AndritzVendorPortal.API.Data;
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
public class UsersController(
    UserManager<ApplicationUser> userManager,
    ApplicationDbContext db) : ControllerBase
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
        // Single query: join Users → UserRoles → Roles to avoid N+1
        var rows = await (
            from u  in db.Users.OrderBy(u => u.FullName)
            join ur in db.UserRoles on u.Id equals ur.UserId into userRoles
            from ur in userRoles.DefaultIfEmpty()
            join r  in db.Roles on ur.RoleId equals r.Id into roles
            from r  in roles.DefaultIfEmpty()
            select new { User = u, RoleName = r.Name }
        ).ToListAsync();

        var result = rows
            .GroupBy(x => x.User)
            .Select(g => new UserDto(
                g.Key.Id,
                g.Key.FullName,
                g.Key.Email ?? string.Empty,
                g.Key.Designation,
                g.Where(x => x.RoleName != null).Select(x => x.RoleName!).ToList()))
            .ToList();

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
        var validRoles = new[] { Roles.Admin, Roles.Buyer, Roles.Approver };
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
    // PUT /api/users/{id}
    // Admin-only: update full name, designation, role, and optionally password.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateUserDto dto)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound("User not found.");

        // Protect Pardeep Sharma — FinalApprover is a fixed role, not reassignable via UI.
        if (user.Email?.Equals("pardeep.sharma@andritz.com", StringComparison.OrdinalIgnoreCase) == true)
            return BadRequest("The Final Approver account cannot be modified through User Management.");

        var validRoles = new[] { Roles.Admin, Roles.Buyer, Roles.Approver };
        if (!validRoles.Contains(dto.Role))
            return BadRequest($"Invalid role. Must be one of: {string.Join(", ", validRoles)}.");

        user.FullName    = dto.FullName;
        user.Designation = dto.Designation ?? string.Empty;

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(updateResult.Errors.Select(e => e.Description).ToList());

        // Update role — remove all existing roles, add the new one
        var currentRoles = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, currentRoles);
        await userManager.AddToRoleAsync(user, dto.Role);

        // Optional password change
        if (!string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            var token  = await userManager.GeneratePasswordResetTokenAsync(user);
            var pwResult = await userManager.ResetPasswordAsync(user, token, dto.NewPassword);
            if (!pwResult.Succeeded)
                return BadRequest(pwResult.Errors.Select(e => e.Description).ToList());
        }

        var roles = await userManager.GetRolesAsync(user);
        return Ok(new UserDto(user.Id, user.FullName, user.Email ?? string.Empty, user.Designation, roles.ToList()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/users/{id}
    // Admin-only: permanently removes a user account.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound("User not found.");

        if (user.Email?.Equals("pardeep.sharma@andritz.com", StringComparison.OrdinalIgnoreCase) == true)
            return BadRequest("The Final Approver account cannot be deleted.");

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description).ToList());

        return NoContent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/users/profile
    // Any authenticated user: update their own display name and optionally password.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var userId = userManager.GetUserId(User);
        var user   = await userManager.FindByIdAsync(userId!);
        if (user is null) return NotFound("User not found.");

        if (string.IsNullOrWhiteSpace(dto.FullName))
            return BadRequest("Full name is required.");

        user.FullName = dto.FullName.Trim();

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(updateResult.Errors.Select(e => e.Description).ToList());

        // Password change is optional — only attempted when both fields are provided.
        if (!string.IsNullOrWhiteSpace(dto.CurrentPassword) && !string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            var pwResult = await userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
            if (!pwResult.Succeeded)
                return BadRequest(pwResult.Errors.Select(e => e.Description).ToList());
        }

        var roles = await userManager.GetRolesAsync(user);
        return Ok(new
        {
            id       = user.Id,
            fullName = user.FullName,
            email    = user.Email,
            roles,
        });
    }

}
