using Microsoft.AspNetCore.Authorization;

namespace AndritzVendorPortal.API.Infrastructure;

/// <summary>
/// Defense-in-depth: the user must hold the FinalApprover role AND
/// their email must match Pardeep Sharma's registered email.
/// This prevents privilege escalation if an admin accidentally
/// grants the role to the wrong account.
/// </summary>
public class FinalApproverRequirement : IAuthorizationRequirement
{
    public const string AuthorizedEmail = "pardeep.sharma@yopmail.com";
}

public class FinalApproverHandler : AuthorizationHandler<FinalApproverRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        FinalApproverRequirement requirement)
    {
        if (!context.User.IsInRole(Roles.FinalApprover))
            return Task.CompletedTask;

        var email = context.User.FindFirst(
            System.Security.Claims.ClaimTypes.Email)?.Value;

        if (string.Equals(email, FinalApproverRequirement.AuthorizedEmail,
                           StringComparison.OrdinalIgnoreCase))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
