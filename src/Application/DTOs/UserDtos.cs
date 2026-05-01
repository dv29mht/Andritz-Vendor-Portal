namespace AndritzVendorPortal.Application.DTOs;

public record UserInfoDto(
    string Id,
    string Email,
    string FullName,
    string Designation,
    bool IsArchived);

public record UserDto(
    string Id,
    string FullName,
    string Email,
    string Designation,
    List<string> Roles);

public record ApproverSummaryDto(
    string Id,
    string Name,
    string? Email);
