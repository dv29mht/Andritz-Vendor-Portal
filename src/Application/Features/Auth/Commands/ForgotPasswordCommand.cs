using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.Auth.Commands;

public record ForgotPasswordCommand(string Email) : IRequest<Unit>;

public class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public class ForgotPasswordCommandHandler(
    IIdentityService identity,
    IEmailService email,
    IConfiguration config) : IRequestHandler<ForgotPasswordCommand, Unit>
{
    public async Task<Unit> Handle(ForgotPasswordCommand request, CancellationToken ct)
    {
        // Always succeed silently to prevent email enumeration.
        var user = await identity.FindByEmailAsync(request.Email);
        if (user is not null && !user.IsArchived)
        {
            var token = await identity.GeneratePasswordResetTokenAsync(user.Email);
            var encoded = Uri.EscapeDataString(token);
            var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";
            var resetLink = $"{portalUrl}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={encoded}";
            var (subject, body) = EmailTemplates.PasswordReset(user.FullName, resetLink);
            await email.SendAsync(user.Email, subject, body);
        }
        return Unit.Value;
    }
}
