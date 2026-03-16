using AndritzVendorPortal.API.Models;
using System.ComponentModel.DataAnnotations;

namespace AndritzVendorPortal.API.DTOs;

// ── Users ────────────────────────────────────────────────────────────────────

public record CreateUserDto(
    [Required]                string  FullName,
    [Required, EmailAddress]  string  Email,
    [Required, MinLength(8)]  string  Password,
    [Required]                string  Role,
                              string? Designation
);

public record UserDto(
    string       Id,
    string       FullName,
    string       Email,
    string       Designation,
    List<string> Roles
);

public record UpdateUserDto(
    [Required] string  FullName,
               string? Designation,
    [Required] string  Role,
               string? NewPassword
);

// ── Auth ─────────────────────────────────────────────────────────────────────

public record LoginDto(
    [Required] string Email,
    [Required] string Password
);

public record AuthUserDto(
    string       Id,
    string       Email,
    string       FullName,
    List<string> Roles
);

public record AuthResponseDto(
    string      Token,
    DateTime    ExpiresAt,
    AuthUserDto User
);

// ── Inbound ─────────────────────────────────────────────────────────────────

public record CreateVendorRequestDto(
    [Required, MaxLength(200)] string  VendorName,
    [Required]                 string  ContactPerson,
                               string? Telephone,
    [Required]                 string  GstNumber,
    [Required]                 string  PanCard,
    [Required]                 string  AddressDetails,
    [Required]                 string  City,
    [Required]                 string  Locality,
                               string? MaterialGroup,
                               string? PostalCode,
                               string? State,
                               string? Country,
                               string? Currency,
                               string? PaymentTerms,
                               string? Incoterms,
                               string? Reason,
                               string? YearlyPvo,
                               bool?   IsOneTimeVendor,
                               string? ProposedBy,
    [Required, MinLength(1)]   List<string> ApproverUserIds
);

public record ResubmitRequestDto(
    [Required, MaxLength(200)] string  VendorName,
    [Required]                 string  ContactPerson,
                               string? Telephone,
    [Required]                 string  GstNumber,
    [Required]                 string  PanCard,
    [Required]                 string  AddressDetails,
    [Required]                 string  City,
    [Required]                 string  Locality,
                               string? MaterialGroup,
                               string? PostalCode,
                               string? State,
                               string? Country,
                               string? Currency,
                               string? PaymentTerms,
                               string? Incoterms,
                               string? Reason,
                               string? YearlyPvo,
                               bool?   IsOneTimeVendor,
                               string? ProposedBy
);

public record ApproveRequestDto(string? Comment);

public record RejectRequestDto([Required] string Comment);

public record CompleteRequestDto(
    [Required, MaxLength(50)] string VendorCode
);

// ── Outbound ─────────────────────────────────────────────────────────────────

/// <summary>
/// Full request shape returned by both GET /api/vendor-requests (list) and
/// GET /api/vendor-requests/{id} (detail). Includes revision history and
/// approval steps so the frontend can render all three VendorDetailModal
/// tabs without a separate round-trip.
/// </summary>
public record VendorRequestDetailDto(
    int                     Id,
    string                  VendorName,
    string                  ContactInformation,   // legacy — kept for backward compat
    string                  ContactPerson,
    string                  Telephone,
    string                  GstNumber,
    string                  PanCard,
    string                  AddressDetails,
    string                  City,
    string                  Locality,
    string                  MaterialGroup,
    string                  PostalCode,
    string                  State,
    string                  Country,
    string                  Currency,
    string                  PaymentTerms,
    string                  Incoterms,
    string                  Reason,
    string                  YearlyPvo,
    bool                    IsOneTimeVendor,
    string                  ProposedBy,
    VendorRequestStatus     Status,
    int                     RevisionNo,
    string?                 RejectionComment,
    string?                 VendorCode,
    DateTime?               VendorCodeAssignedAt,
    string?                 VendorCodeAssignedBy,
    string                  CreatedByUserId,
    string                  CreatedByName,
    DateTime                CreatedAt,
    DateTime                UpdatedAt,
    List<string>            PendingApproverUserIds,
    List<ApprovalStepDto>   ApprovalSteps,
    List<VendorRevisionDto> RevisionHistory
);

public record ApprovalStepDto(
    int              Id,
    string           ApproverUserId,
    string           ApproverName,
    int              StepOrder,
    ApprovalDecision Decision,
    string?          Comment,
    DateTime?        DecidedAt,
    bool             IsFinalApproval
);

public record VendorRevisionDto(
    int                  RevisionNo,
    string               ChangedByUserId,
    string               ChangedByName,
    DateTime             ChangedAt,
    string?              RejectionComment,
    List<FieldChangeDto> Changes
);

public record FieldChangeDto(
    string Field,
    string FieldLabel,
    string OldValue,
    string NewValue
);
