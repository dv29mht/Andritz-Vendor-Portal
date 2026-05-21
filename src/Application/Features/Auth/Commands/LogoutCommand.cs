using AndritzVendorPortal.Application.Interfaces;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Auth.Commands;

public record LogoutCommand : IRequest<Unit>;

public class LogoutCommandHandler(
    ICurrentUserService currentUser,
    IIdentityService identity,
    ILoginSecurityService loginSecurity) : IRequestHandler<LogoutCommand, Unit>
{
    public async Task<Unit> Handle(LogoutCommand request, CancellationToken ct)
    {
        // Anonymous logout (expired token, never logged in) — nothing to revoke;
        // the controller still clears cookies. Frontend can call /logout safely
        // either way.
        if (!currentUser.IsAuthenticated || string.IsNullOrEmpty(currentUser.UserId))
            return Unit.Value;

        var roles = await identity.GetRolesAsync(currentUser.UserId);
        if (roles.Count > 0)
            await loginSecurity.RevokeAllAsync(currentUser.UserId, roles, ct);

        return Unit.Value;
    }
}
