using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Auth.Commands;

public record ResetPasswordCommand(string Email, string Token, string NewPassword) : IRequest<Unit>;

public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}

public class ResetPasswordCommandHandler(IIdentityService identity)
    : IRequestHandler<ResetPasswordCommand, Unit>
{
    public async Task<Unit> Handle(ResetPasswordCommand request, CancellationToken ct)
    {
        var user = await identity.FindByEmailAsync(request.Email);
        if (user is null || user.IsArchived)
            throw new BadRequestException("Invalid request.");

        var (succeeded, errors) = await identity.ResetPasswordAsync(request.Email, request.Token, request.NewPassword);
        if (!succeeded)
            throw new BadRequestException(errors.FirstOrDefault() ?? "Reset failed.", errors);

        return Unit.Value;
    }
}
