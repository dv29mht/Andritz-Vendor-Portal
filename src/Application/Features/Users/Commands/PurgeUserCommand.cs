using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record PurgeUserCommand(string Id) : IRequest<Unit>;

public class PurgeUserCommandHandler(IIdentityService identity)
    : IRequestHandler<PurgeUserCommand, Unit>
{
    public async Task<Unit> Handle(PurgeUserCommand request, CancellationToken ct)
    {
        var user = await identity.FindByIdAsync(request.Id)
            ?? throw new NotFoundException("User", request.Id);

        if (string.Equals(user.Email, SystemAccounts.FinalApproverEmail, StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("The Final Approver account cannot be deleted.");

        var (ok, errors) = await identity.PurgeUserAsync(request.Id);
        if (!ok)
            throw new BadRequestException("Purge failed.", errors);

        return Unit.Value;
    }
}
