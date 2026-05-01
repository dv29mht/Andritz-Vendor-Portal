using AndritzVendorPortal.Domain.Enums;

namespace AndritzVendorPortal.Application.DTOs;

public record ApprovalStepDto(
    int Id,
    string ApproverUserId,
    string ApproverName,
    int StepOrder,
    ApprovalDecision Decision,
    string? Comment,
    DateTime? DecidedAt,
    bool IsFinalApproval,
    bool IsDeletedApprover,
    string? DeletedApproverNote);

public record FieldChangeDto(
    string Field,
    string FieldLabel,
    string OldValue,
    string NewValue);

public record VendorRevisionDto(
    int RevisionNo,
    string ChangedByUserId,
    string ChangedByName,
    DateTime ChangedAt,
    string? RejectionComment,
    string RevisionType,
    List<FieldChangeDto> Changes);

public record VendorRequestDetailDto(
    int Id,
    string VendorName,
    string ContactInformation,
    string ContactPerson,
    string Telephone,
    string GstNumber,
    string PanCard,
    string AddressDetails,
    string City,
    string Locality,
    string MaterialGroup,
    string PostalCode,
    string State,
    string Country,
    string Currency,
    string PaymentTerms,
    string Incoterms,
    string Reason,
    string YearlyPvo,
    bool IsOneTimeVendor,
    string ProposedBy,
    VendorRequestStatus Status,
    int RevisionNo,
    string? RejectionComment,
    string? VendorCode,
    DateTime? VendorCodeAssignedAt,
    string? VendorCodeAssignedBy,
    string CreatedByUserId,
    string CreatedByName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    bool IsArchived,
    DateTime? ArchivedAt,
    List<string> PendingApproverUserIds,
    List<ApprovalStepDto> ApprovalSteps,
    List<VendorRevisionDto> RevisionHistory);
