using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;

namespace AndritzVendorPortal.Application.Features.Users.Queries;

public record GetAllUsersQuery(bool IncludeArchived = false) : IRequest<List<UserDto>>;

public class GetAllUsersQueryHandler(IIdentityService identity)
    : IRequestHandler<GetAllUsersQuery, List<UserDto>>
{
    public async Task<List<UserDto>> Handle(GetAllUsersQuery request, CancellationToken ct)
    {
        var users = await identity.GetUsersWithRolesAsync(includeArchived: request.IncludeArchived);

        return users
            .Where(u => request.IncludeArchived ? u.IsArchived : !u.IsArchived)
            .OrderBy(u => u.FullName)
            .Select(u => new UserDto(u.Id, u.FullName, u.Email, u.Designation, u.Roles.ToList()))
            .ToList();
    }
}
