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
            .Where(u => !u.IsArchived)
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
        var rows = await (
            from u  in db.Users.Where(u => !u.IsArchived).OrderBy(u => u.FullName)
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
    // GET /api/users/archived
    // Admin-only: returns soft-deleted (archived) user accounts.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("archived")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> GetArchived()
    {
        var rows = await (
            from u  in db.Users.Where(u => u.IsArchived).OrderBy(u => u.FullName)
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

        if (user.IsArchived)
            return BadRequest("Cannot modify an archived account.");

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

        // Propagate new name to all denormalized snapshots
        await db.VendorRequests
            .Where(r => r.CreatedByUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CreatedByName, user.FullName));
        await db.VendorRevisions
            .Where(v => v.ChangedByUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.ChangedByName, user.FullName));
        await db.ApprovalSteps
            .Where(a => a.ApproverUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ApproverName, user.FullName));

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
    // Admin-only: soft-deletes a user.
    //
    // Deletion rules for approvers:
    //   - BLOCKED  if the user's step is currently active (it is their turn right
    //              now — i.e. no earlier non-deleted step is still pending).
    //              The admin must wait for that request to clear first.
    //   - ALLOWED  if their pending step is only queued for the future (an earlier
    //              step in the chain is still pending). Those future steps are
    //              marked IsDeletedApprover = true and auto-skipped by the workflow.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound("User not found.");

        if (user.Email?.Equals("pardeep.sharma@andritz.com", StringComparison.OrdinalIgnoreCase) == true)
            return BadRequest("The Final Approver account cannot be deleted.");

        // Load all pending steps for this user (across all requests)
        var pendingSteps = await db.ApprovalSteps
            .Where(s => s.ApproverUserId == id && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
            .Include(s => s.VendorRequest)
                .ThenInclude(r => r!.ApprovalSteps)
            .ToListAsync();

        // For each pending step, check if it is currently active (their turn right now).
        // A step is active when there is no earlier step in the same request that is
        // still pending (and not already marked as a deleted-approver step).
        var activelyPendingRequests = pendingSteps
            .Where(myStep =>
            {
                if (myStep.VendorRequest is null) return false;
                bool blockedByEarlierStep = myStep.VendorRequest.ApprovalSteps.Any(s =>
                    s.StepOrder < myStep.StepOrder &&
                    s.Decision == ApprovalDecision.Pending &&
                    !s.IsDeletedApprover);
                return !blockedByEarlierStep;  // not blocked → this IS the active step
            })
            .ToList();

        if (activelyPendingRequests.Count > 0)
        {
            var requestIds = activelyPendingRequests
                .Select(s => s.VendorRequestId)
                .Distinct()
                .OrderBy(x => x)
                .ToList();
            return Conflict(
                $"This approver is the current active approver on {activelyPendingRequests.Count} " +
                $"pending request(s) (IDs: {string.Join(", ", requestIds)}). " +
                "Wait for those requests to advance or be reassigned before deleting this user.");
        }

        // Mark all future-queued steps as deleted — they will be auto-skipped
        // by the workflow engine without disrupting the chain.
        foreach (var step in pendingSteps)
        {
            step.IsDeletedApprover   = true;
            step.DeletedApproverNote = $"User deleted by Admin on {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC";
        }

        // For each affected request, re-evaluate the workflow now that a step was
        // logically removed. If all remaining non-final steps are already approved
        // (or deleted), advance the status.
        var affectedRequestIds = pendingSteps.Select(s => s.VendorRequestId).Distinct().ToList();
        if (affectedRequestIds.Count > 0)
        {
            var affectedRequests = await db.VendorRequests
                .Include(r => r.ApprovalSteps)
                .Where(r => affectedRequestIds.Contains(r.Id))
                .ToListAsync();

            foreach (var req in affectedRequests)
            {
                // Only advance if request is actively in workflow
                if (req.Status == VendorRequestStatus.PendingApproval)
                    Infrastructure.ApprovalChain.AdvanceWorkflow(req);

                req.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Soft-delete: mark as archived so vendor request history is preserved
        user.IsArchived = true;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description).ToList());

        await db.SaveChangesAsync();
        return NoContent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/users/{id}/restore
    // Admin-only: un-archives a previously soft-deleted user account.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("{id}/restore")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Restore(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound("User not found.");

        if (!user.IsArchived)
            return BadRequest("This account is not archived.");

        user.IsArchived = false;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            return BadRequest(result.Errors.Select(e => e.Description).ToList());

        var roles = await userManager.GetRolesAsync(user);
        return Ok(new UserDto(user.Id, user.FullName, user.Email ?? string.Empty, user.Designation, roles.ToList()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/users/{id}/purge
    // Admin-only: permanently and irreversibly removes a user record from the DB.
    // Use only for accounts that should be fully erased (e.g. test/duplicate accounts).
    // ─────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id}/purge")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Purge(string id)
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

        if (user.IsArchived)
            return Unauthorized("This account has been deactivated. Contact your administrator.");

        if (string.IsNullOrWhiteSpace(dto.FullName))
            return BadRequest("Full name is required.");

        user.FullName = dto.FullName.Trim();

        var updateResult = await userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(updateResult.Errors.Select(e => e.Description).ToList());

        // Propagate new name to all denormalized snapshots
        await db.VendorRequests
            .Where(r => r.CreatedByUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.CreatedByName, user.FullName));
        await db.VendorRevisions
            .Where(v => v.ChangedByUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.ChangedByName, user.FullName));
        await db.ApprovalSteps
            .Where(a => a.ApproverUserId == user.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.ApproverName, user.FullName));

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
