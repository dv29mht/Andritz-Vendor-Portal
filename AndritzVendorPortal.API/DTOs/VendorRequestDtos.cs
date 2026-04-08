using AndritzVendorPortal.API.Models;
using System.ComponentModel.DataAnnotations;

namespace AndritzVendorPortal.API.DTOs;

// ── Auth ─────────────────────────────────────────────────────────────────────

public record ForgotPasswordDto([Required, EmailAddress] string Email);

public record ResetPasswordDto(
    [Required, EmailAddress] string Email,
    [Required]               string Token,
    [Required, MinLength(8)] string NewPassword
);

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
    [Required]                string  FullName,
                              string? Designation,
    [Required]                string  Role,
                              string? NewPassword,
    [Required, EmailAddress]  string  Email
);

public record UpdateProfileDto(
    [Required] string  FullName,
               string? CurrentPassword,
               string? NewPassword
);

// ── Auth ─────────────────────────────────────────────────────────────────────

public record LoginDto(
    [Required, EmailAddress] string Email,
    [Required]               string Password
);

public record AuthUserDto(
    string       Id,
    string       Email,
    string       FullName,
    List<string> Roles,
    string?      Designation
);

public record AuthResponseDto(
    DateTime    ExpiresAt,
    AuthUserDto User,
    string      Token,      // JWT for Authorization: Bearer header (Vercel proxy cannot forward httpOnly cookies)
    string      CsrfToken   // returned in body so cross-domain SPAs can store it
);

// ── Inbound ─────────────────────────────────────────────────────────────────

// GST: 15-char Indian format (e.g. 22AAAAA0000A1Z5)
// PAN: 10-char Indian format (e.g. ABCDE1234F)
internal static class ValidationPatterns
{
    public const string Gst = @"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$";
    public const string Pan = @"^[A-Z]{5}[0-9]{4}[A-Z]$";
}

/// <summary>All fields optional — used when saving a new request as Draft without submitting.</summary>
public record SaveNewDraftDto(
    [MaxLength(200)]  string?       VendorName,
    [MaxLength(100)]  string?       ContactPerson,
    [MaxLength(30)]   string?       Telephone,
    [MaxLength(15)]   string?       GstNumber,
    [MaxLength(10)]   string?       PanCard,
    [MaxLength(500)]  string?       AddressDetails,
    [MaxLength(100)]  string?       City,
    [MaxLength(100)]  string?       Locality,
    [MaxLength(200)]  string?       MaterialGroup,
    [MaxLength(10)]   string?       PostalCode,
    [MaxLength(100)]  string?       State,
    [MaxLength(100)]  string?       Country,
    [MaxLength(10)]   string?       Currency,
    [MaxLength(200)]  string?       PaymentTerms,
    [MaxLength(200)]  string?       Incoterms,
    [MaxLength(1000)] string?       Reason,
    [MaxLength(100)]  string?       YearlyPvo,
                      bool?         IsOneTimeVendor,
    [MaxLength(200)]  string?       ProposedBy,
                      List<string>? ApproverUserIds
);

public record CreateVendorRequestDto(
    [Required, MaxLength(200)]                                                    string  VendorName,
    [Required, MaxLength(100)]                                                    string  ContactPerson,
    [MaxLength(30)]                                                               string? Telephone,
    [Required, RegularExpression(ValidationPatterns.Gst,
        ErrorMessage = "GST number must be in the format 22AAAAA0000A1Z5 (15 characters).")]
                                                                                  string  GstNumber,
    [Required, RegularExpression(ValidationPatterns.Pan,
        ErrorMessage = "PAN card must be in the format ABCDE1234F (10 characters).")]
                                                                                  string  PanCard,
    [Required, MaxLength(500)]                                                    string  AddressDetails,
    [Required, MaxLength(100)]                                                    string  City,
    [Required, MaxLength(100)]                                                    string  Locality,
    [MaxLength(200)]                                                              string? MaterialGroup,
    [MaxLength(10)]                                                               string? PostalCode,
    [MaxLength(100)]                                                              string? State,
    [MaxLength(100)]                                                              string? Country,
    [MaxLength(10)]                                                               string? Currency,
    [MaxLength(200)]                                                              string? PaymentTerms,
    [MaxLength(200)]                                                              string? Incoterms,
    [MaxLength(1000)]                                                             string? Reason,
    [MaxLength(100)]                                                              string? YearlyPvo,
                                                                                  bool?   IsOneTimeVendor,
    [MaxLength(200)]                                                              string? ProposedBy,
                                                                                  List<string>? ApproverUserIds
);

public record ResubmitRequestDto(
    [Required, MaxLength(200)]                                                    string  VendorName,
    [Required, MaxLength(100)]                                                    string  ContactPerson,
    [MaxLength(30)]                                                               string? Telephone,
    [Required, RegularExpression(ValidationPatterns.Gst,
        ErrorMessage = "GST number must be in the format 22AAAAA0000A1Z5 (15 characters).")]
                                                                                  string  GstNumber,
    [Required, RegularExpression(ValidationPatterns.Pan,
        ErrorMessage = "PAN card must be in the format ABCDE1234F (10 characters).")]
                                                                                  string  PanCard,
    [Required, MaxLength(500)]                                                    string  AddressDetails,
    [Required, MaxLength(100)]                                                    string  City,
    [Required, MaxLength(100)]                                                    string  Locality,
    [MaxLength(200)]                                                              string? MaterialGroup,
    [MaxLength(10)]                                                               string? PostalCode,
    [MaxLength(100)]                                                              string? State,
    [MaxLength(100)]                                                              string? Country,
    [MaxLength(10)]                                                               string? Currency,
    [MaxLength(200)]                                                              string? PaymentTerms,
    [MaxLength(200)]                                                              string? Incoterms,
    [MaxLength(1000)]                                                             string? Reason,
    [MaxLength(100)]                                                              string? YearlyPvo,
                                                                                  bool?   IsOneTimeVendor,
    [MaxLength(200)]                                                              string? ProposedBy,
    // Optional: if any approver in the original chain no longer exists the buyer
    // must supply a replacement chain. When null the original chain is reused.
                                                                                  List<string>? ApproverUserIds
);

public record AdminEditVendorRequestDto(
    [Required, MaxLength(200)]  string  VendorName,
    [Required, MaxLength(100)]  string  ContactPerson,
    [MaxLength(30)]             string? Telephone,
    [Required, RegularExpression(ValidationPatterns.Gst,
        ErrorMessage = "GST number must be in the format 22AAAAA0000A1Z5 (15 characters).")]
                                string  GstNumber,
    [Required, RegularExpression(ValidationPatterns.Pan,
        ErrorMessage = "PAN card must be in the format ABCDE1234F (10 characters).")]
                                string  PanCard,
    [Required, MaxLength(500)]  string  AddressDetails,
    [Required, MaxLength(100)]  string  City,
    [Required, MaxLength(100)]  string  Locality,
    [MaxLength(200)]            string? MaterialGroup,
    [MaxLength(10)]             string? PostalCode,
    [MaxLength(100)]            string? State,
    [MaxLength(100)]            string? Country,
    [MaxLength(10)]             string? Currency,
    [MaxLength(200)]            string? PaymentTerms,
    [MaxLength(200)]            string? Incoterms,
    [MaxLength(1000)]           string? Reason,
    [MaxLength(100)]            string? YearlyPvo,
                                bool?   IsOneTimeVendor,
    [MaxLength(200)]            string? ProposedBy
);

public record ClassifyVendorRequestDto(bool IsOneTimeVendor);

public record ApproveRequestDto([MaxLength(500)] string? Comment);

public record RejectRequestDto([Required, MaxLength(500)] string Comment);

public record CompleteRequestDto(
    [Required, RegularExpression(@"^\d{1,10}$", ErrorMessage = "Vendor code must be 1–10 digits.")] string VendorCode
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
    bool                    IsArchived,
    DateTime?               ArchivedAt,
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
    bool             IsFinalApproval,
    bool             IsDeletedApprover,
    string?          DeletedApproverNote
);

public record VendorRevisionDto(
    int                  RevisionNo,
    string               ChangedByUserId,
    string               ChangedByName,
    DateTime             ChangedAt,
    string?              RejectionComment,
    string               RevisionType,
    List<FieldChangeDto> Changes
);

public record FieldChangeDto(
    string Field,
    string FieldLabel,
    string OldValue,
    string NewValue
);
