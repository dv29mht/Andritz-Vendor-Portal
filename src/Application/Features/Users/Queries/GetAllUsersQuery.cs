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
        var users = await identity.GetAllUsersAsync(includeArchived: request.IncludeArchived);
        var filtered = request.IncludeArchived
            ? users.Where(u => u.IsArchived)
            : users.Where(u => !u.IsArchived);

        var list = new List<UserDto>();
        foreach (var u in filtered.OrderBy(u => u.FullName))
        {
            var roles = await identity.GetRolesAsync(u.Id);
            list.Add(new UserDto(u.Id, u.FullName, u.Email, u.Designation, roles.ToList()));
        }
        return list;
    }
}
