using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Interfaces;
using System.Security.Claims;

namespace AndritzVendorPortal.API.Services;

public class CurrentUserService(IHttpContextAccessor http) : ICurrentUserService
{
    private ClaimsPrincipal? User => http.HttpContext?.User;

    public string? UserId => User?.FindFirstValue(ClaimTypes.NameIdentifier);
    public string? Email => User?.FindFirstValue(ClaimTypes.Email);
    public string? FullName => User?.FindFirstValue("name");
    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;
    public bool IsInRole(string role) => User?.IsInRole(role) ?? false;

    public string RequireUserId() =>
        UserId ?? throw new UnauthorizedException("Authenticated user has no NameIdentifier claim.");
}
