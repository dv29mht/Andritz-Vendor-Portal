using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using System.Text.Json;

namespace AndritzVendorPortal.Application.Features.VendorRequests.Common;

/// <summary>
/// Centralised mapping from VendorRequest entity → VendorRequestDetailDto, including
/// the active-pending-approver computation and revision JSON deserialization.
/// </summary>
public static class VendorRequestMapper
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static VendorRequestDetailDto ToDetailDto(VendorRequest r)
    {
        var sortedSteps = r.ApprovalSteps.OrderBy(s => s.StepOrder).ToList();

        var pendingApproverUserIds = r.Status switch
        {
            VendorRequestStatus.PendingApproval =>
                sortedSteps
                    .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
                    .OrderBy(s => s.StepOrder)
                    .Take(1)
                    .Select(s => s.ApproverUserId)
                    .ToList(),
            VendorRequestStatus.PendingFinalApproval =>
                sortedSteps
                    .Where(s => s.IsFinalApproval && s.Decision == ApprovalDecision.Pending && !s.IsDeletedApprover)
                    .Select(s => s.ApproverUserId)
                    .ToList(),
            _ => new List<string>()
        };

        var revisionHistory = r.RevisionHistory
            .OrderBy(v => v.RevisionNo)
            .Select(v => new VendorRevisionDto(
                v.RevisionNo,
                v.ChangedByUserId,
                v.ChangedByName,
                v.ChangedAt,
                v.RejectionComment,
                v.RevisionType.ToString(),
                DeserializeChanges(v.ChangesJson)))
            .ToList();

        return new VendorRequestDetailDto(
            r.Id, r.VendorName, r.ContactInformation, r.ContactPerson, r.Telephone,
            r.GstNumber, r.PanCard,
            r.AddressDetails, r.City, r.Locality,
            r.MaterialGroup, r.PostalCode, r.State, r.Country,
            r.Currency, r.PaymentTerms, r.Incoterms, r.Reason, r.YearlyPvo,
            r.IsOneTimeVendor, r.ProposedBy,
            r.Status, r.RevisionNo, r.RejectionComment,
            r.VendorCode, r.VendorCodeAssignedAt, r.VendorCodeAssignedBy,
            r.CreatedByUserId, r.CreatedByName, r.CreatedAt, r.UpdatedAt,
            r.IsArchived, r.ArchivedAt,
            pendingApproverUserIds,
            sortedSteps.Select(s => new ApprovalStepDto(
                s.Id, s.ApproverUserId, s.ApproverName, s.StepOrder,
                s.Decision, s.Comment, s.DecidedAt, s.IsFinalApproval,
                s.IsDeletedApprover, s.DeletedApproverNote)).ToList(),
            revisionHistory);
    }

    public static EmailTemplates.VendorSummary ToSummary(VendorRequest r) => new(
        r.Id, r.VendorName, r.MaterialGroup, r.GstNumber, r.PanCard,
        r.City, r.State, r.Country, r.CreatedByName, r.RevisionNo);

    public static string SerializeChanges(IEnumerable<FieldChangeRecord> changes) =>
        JsonSerializer.Serialize(changes, JsonOpts);

    private static List<FieldChangeDto> DeserializeChanges(string json)
    {
        try
        {
            var records = JsonSerializer.Deserialize<List<FieldChangeRecord>>(json, JsonOpts);
            return records?.Select(c => new FieldChangeDto(c.Field, c.FieldLabel, c.OldValue, c.NewValue)).ToList()
                ?? [];
        }
        catch
        {
            return [];
        }
    }
}
