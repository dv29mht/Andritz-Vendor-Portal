using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record RestoreUserCommand(string Id) : IRequest<UserDto>;

public class RestoreUserCommandHandler(IIdentityService identity)
    : IRequestHandler<RestoreUserCommand, UserDto>
{
    public async Task<UserDto> Handle(RestoreUserCommand request, CancellationToken ct)
    {
        var user = await identity.FindByIdAsync(request.Id)
            ?? throw new NotFoundException("User", request.Id);
        if (!user.IsArchived)
            throw new BadRequestException("This account is not archived.");

        var (ok, errors) = await identity.RestoreUserAsync(request.Id);
        if (!ok)
            throw new BadRequestException("Restore failed.", errors);

        var roles = await identity.GetRolesAsync(request.Id);
        return new UserDto(user.Id, user.FullName, user.Email, user.Designation, roles.ToList());
    }
}
