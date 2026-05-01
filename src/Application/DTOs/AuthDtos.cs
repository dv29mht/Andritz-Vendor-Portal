namespace AndritzVendorPortal.Application.DTOs;

public record AuthUserDto(
    string Id,
    string Email,
    string FullName,
    List<string> Roles,
    string? Designation);

public record AuthResponseDto(
    DateTime ExpiresAt,
    AuthUserDto User,
    string Token,
    string CsrfToken);
