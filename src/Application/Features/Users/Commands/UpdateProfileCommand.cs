using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record UpdateProfileCommand(
    string FullName,
    string? CurrentPassword,
    string? NewPassword) : IRequest<object>;

public class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        When(x => !string.IsNullOrEmpty(x.NewPassword),
            () =>
            {
                RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Current password required to change password.");
                RuleFor(x => x.NewPassword!).MinimumLength(8);
            });
    }
}

public class UpdateProfileCommandHandler(
    ICurrentUserService currentUser,
    IIdentityService identity) : IRequestHandler<UpdateProfileCommand, object>
{
    public async Task<object> Handle(UpdateProfileCommand request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var user = await identity.FindByIdAsync(userId)
            ?? throw new NotFoundException("User", userId);

        if (user.IsArchived)
            throw new UnauthorizedException("This account has been deactivated. Contact your administrator.");

        var passwordChanging = !string.IsNullOrEmpty(request.NewPassword);

        var (ok, errors) = await identity.UpdateProfileAsync(
            userId, request.FullName.Trim(), request.CurrentPassword, request.NewPassword);
        if (!ok)
            // Surface the specific reason (e.g. "Incorrect password.") in the message
            // itself, not just the errors list, so logs and any client that only reads
            // `message` show what actually went wrong.
            throw new BadRequestException(
                errors.Count > 0 ? string.Join(" ", errors) : "Profile update failed.", errors);

        await identity.PropagateUserNameChangeAsync(userId, request.FullName.Trim(), ct);

        var roles = await identity.GetRolesAsync(userId);

        // A self-service password change does NOT revoke the current session — the
        // JWT doesn't carry the password, so the token the user is holding stays
        // valid and they remain signed in. (We deliberately don't force-log-out
        // other devices here either; tokens expire on their own.)
        _ = passwordChanging;

        return new
        {
            id = userId,
            fullName = request.FullName.Trim(),
            email = user.Email,
            roles
        };
    }
}
