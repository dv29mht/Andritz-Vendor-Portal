using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record CreateUserCommand(
    string FullName,
    string Email,
    string Password,
    string Role,
    string? Designation) : IRequest<UserDto>;

public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.Role).NotEmpty()
            .Must(r => Roles.AssignableByAdmin.Contains(r))
            .WithMessage($"Invalid role. Must be one of: {string.Join(", ", Roles.AssignableByAdmin)}.");
    }
}

public class CreateUserCommandHandler(
    IIdentityService identity,
    IEmailService email,
    IConfiguration config) : IRequestHandler<CreateUserCommand, UserDto>
{
    public async Task<UserDto> Handle(CreateUserCommand request, CancellationToken ct)
    {
        if (await identity.FindByEmailAsync(request.Email) is not null)
            throw new ConflictException("A user with this email address already exists.");

        var (ok, userId, errors) = await identity.CreateUserAsync(
            request.Email, request.Password, request.FullName, request.Designation, request.Role);

        if (!ok)
            throw new BadRequestException("Failed to create user.", errors);

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
        var (subject, body) = EmailTemplates.WelcomeUser(request.FullName, request.Email, request.Role, portalUrl);
        await email.SendAsync(request.Email, subject, body);

        return new UserDto(userId, request.FullName, request.Email, request.Designation ?? string.Empty, [request.Role]);
    }
}
