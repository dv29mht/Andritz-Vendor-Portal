namespace AndritzVendorPortal.Application.DTOs;

public record EmailTemplateListItemDto(
    int Id,
    string Code,
    string Name,
    string Audience,
    string Subject,
    string Placeholders,
    DateTime UpdatedAt,
    bool IsModified);

public record EmailTemplateDetailDto(
    int Id,
    string Code,
    string Name,
    string Audience,
    string Subject,
    string BodyText,
    string DefaultSubject,
    string DefaultBodyText,
    string Placeholders,
    DateTime UpdatedAt,
    bool IsModified);

public record UpdateEmailTemplateDto(string Subject, string BodyText);
