using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<AuthResponseDto>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class LoginCommandHandler(
    IIdentityService identity,
    IJwtTokenService jwt) : IRequestHandler<LoginCommand, AuthResponseDto>
{
    public async Task<AuthResponseDto> Handle(LoginCommand request, CancellationToken ct)
    {
        var user = await identity.FindByEmailAsync(request.Email);

        // Unknown email and wrong password must be indistinguishable, and the
        // archived check must not short-circuit the lockout counter — otherwise an
        // attacker can enumerate accounts (and which are deactivated) and probe a
        // disabled account without ever tripping lockout. So: prove credentials
        // first (generic failure + lockout applies), and only then disclose the
        // deactivated state to someone who already holds the correct password.
        if (user is null)
            throw new UnauthorizedException("Invalid email or password.");

        if (await identity.IsLockedOutAsync(request.Email))
            throw new UnauthorizedException("Account locked due to too many failed attempts. Try again in 5 minutes.");

        if (!await identity.CheckPasswordAsync(request.Email, request.Password))
            throw new UnauthorizedException("Invalid email or password.");

        if (user.IsArchived)
            throw new UnauthorizedException("This account has been deactivated. Contact your administrator.");

        var roles = await identity.GetRolesAsync(user.Id);
        var (token, expiresAt) = jwt.GenerateToken(user, roles);
        var csrf = Guid.NewGuid().ToString("N");

        return new AuthResponseDto(
            ExpiresAt: expiresAt,
            User: new AuthUserDto(user.Id, user.Email, user.FullName, roles.ToList(), user.Designation),
            Token: token,
            CsrfToken: csrf);
    }
}
