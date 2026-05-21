using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record UpdateUserCommand(
    string Id,
    string FullName,
    string Email,
    string? Designation,
    string Role,
    string? NewPassword) : IRequest<UserDto>;

public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Role).NotEmpty()
            .Must(r => Roles.AssignableByAdmin.Contains(r))
            .WithMessage($"Invalid role. Must be one of: {string.Join(", ", Roles.AssignableByAdmin)}.");
        When(x => !string.IsNullOrEmpty(x.NewPassword),
            () => RuleFor(x => x.NewPassword!).MinimumLength(8));
    }
}

public class UpdateUserCommandHandler(
    IIdentityService identity,
    ILoginSecurityService loginSecurity)
    : IRequestHandler<UpdateUserCommand, UserDto>
{
    public async Task<UserDto> Handle(UpdateUserCommand request, CancellationToken ct)
    {
        var user = await identity.FindByIdAsync(request.Id)
            ?? throw new NotFoundException("User", request.Id);

        if (user.IsArchived)
            throw new BadRequestException("Cannot modify an archived account.");

        if (string.Equals(user.Email, SystemAccounts.FinalApproverEmail, StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("The Final Approver account cannot be modified through User Management.");

        // Email-uniqueness check when email is changing
        if (!string.Equals(user.Email, request.Email, StringComparison.OrdinalIgnoreCase))
        {
            var existing = await identity.FindByEmailAsync(request.Email);
            if (existing is not null && existing.Id != user.Id)
                throw new ConflictException("A user with this email address already exists.");
        }

        // Capture old roles before UpdateUserAsync rewrites them, so we can
        // revoke tokens carrying the *old* role claim — otherwise a token
        // issued before the change keeps the privileges of the old role.
        var oldRoles = await identity.GetRolesAsync(request.Id);
        var passwordChanging = !string.IsNullOrEmpty(request.NewPassword);

        var (ok, errors) = await identity.UpdateUserAsync(
            request.Id, request.FullName, request.Email, request.Designation, request.Role, request.NewPassword);
        if (!ok)
            throw new BadRequestException("Update failed.", errors);

        // Propagate name change to denormalized snapshots
        await identity.PropagateUserNameChangeAsync(request.Id, request.FullName, ct);

        var roles = await identity.GetRolesAsync(request.Id);

        var roleChanged = !oldRoles.OrderBy(r => r).SequenceEqual(roles.OrderBy(r => r), StringComparer.Ordinal);
        if (passwordChanging || roleChanged)
        {
            // Revoke against the union — old role tokens carry the old role
            // claim, new role tokens won't exist yet but we set a fresh
            // cutoff there too so a race issuing one in-flight is also covered.
            var union = oldRoles.Concat(roles).Distinct(StringComparer.Ordinal).ToList();
            if (union.Count > 0)
                await loginSecurity.RevokeAllAsync(request.Id, union, ct);
        }

        return new UserDto(request.Id, request.FullName, request.Email, request.Designation ?? string.Empty, roles.ToList());
    }
}
