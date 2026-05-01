using AndritzVendorPortal.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace AndritzVendorPortal.API.Authorization;

/// <summary>
/// Defense-in-depth: user must have FinalApprover role AND email must match
/// the configured Final Approver email. Stops privilege escalation if an admin
/// accidentally grants the role to the wrong account.
/// </summary>
public class FinalApproverRequirement : IAuthorizationRequirement { }

public class FinalApproverHandler : AuthorizationHandler<FinalApproverRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        FinalApproverRequirement requirement)
    {
        if (!context.User.IsInRole(Roles.FinalApprover))
            return Task.CompletedTask;

        var email = context.User.FindFirst(ClaimTypes.Email)?.Value;
        if (string.Equals(email, SystemAccounts.FinalApproverEmail, StringComparison.OrdinalIgnoreCase))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
