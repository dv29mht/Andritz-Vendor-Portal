namespace AndritzVendorPortal.Application.DTOs;

public record NotificationDto(
    int Id,
    int? VendorRequestId,
    string Type,
    string Title,
    string Body,
    bool IsRead,
    DateTime CreatedAt);
