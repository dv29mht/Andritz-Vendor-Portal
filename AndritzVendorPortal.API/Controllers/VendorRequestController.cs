using AndritzVendorPortal.API.Data;
using AndritzVendorPortal.API.DTOs;
using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/vendor-requests")]
[Authorize]
public class VendorRequestController(ApplicationDbContext db) : ControllerBase
{
    // Tracks which fields are included in revision diffs — matches frontend TRACKED_FIELDS
    private record TrackedField(
        string CamelKey, string Label,
        Func<VendorRequest, string>      GetFromRequest,
        Func<ResubmitRequestDto, string> GetFromDto);

    private static readonly TrackedField[] TrackedFields =
    [
        new("vendorName",    "Vendor Name",    r => r.VendorName,    d => d.VendorName),
        new("materialGroup", "Material Group", r => r.MaterialGroup, d => d.MaterialGroup ?? string.Empty),
        new("reason",        "Reason",         r => r.Reason,        d => d.Reason        ?? string.Empty),
        new("contactPerson", "Contact Person", r => r.ContactPerson, d => d.ContactPerson ?? string.Empty),
        new("telephone",     "Telephone",      r => r.Telephone,     d => d.Telephone     ?? string.Empty),
        new("gstNumber",     "GST Number",     r => r.GstNumber,     d => d.GstNumber),
        new("panCard",       "PAN Card",       r => r.PanCard,       d => d.PanCard),
        new("addressDetails","Address Details",r => r.AddressDetails,d => d.AddressDetails),
        new("postalCode",    "Postal Code",    r => r.PostalCode,    d => d.PostalCode    ?? string.Empty),
        new("city",          "City",           r => r.City,          d => d.City),
        new("locality",      "Locality",       r => r.Locality,      d => d.Locality),
        new("state",         "State",          r => r.State,         d => d.State         ?? string.Empty),
        new("country",       "Country",        r => r.Country,       d => d.Country       ?? string.Empty),
        new("currency",      "Currency",       r => r.Currency,      d => d.Currency      ?? string.Empty),
        new("paymentTerms",  "Payment Terms",  r => r.PaymentTerms,  d => d.PaymentTerms  ?? string.Empty),
        new("incoterms",     "Incoterms",      r => r.Incoterms,     d => d.Incoterms     ?? string.Empty),
        new("yearlyPvo",     "Yearly PVO",     r => r.YearlyPvo,     d => d.YearlyPvo     ?? string.Empty),
    ];

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/vendor-requests
    // Admin: all; Buyer: own; Approver/FinalApprover: assigned requests.
    // Returns full shape (including approvalSteps + revisionHistory) so the
    // frontend can render consoles and VendorDetailModal without extra calls.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<IActionResult> GetAll()
    {
        var userId  = UserId();
        var isAdmin = User.IsInRole(Roles.Admin);

        IQueryable<VendorRequest> query = db.VendorRequests.AsNoTracking();

        if (!isAdmin)
        {
            if (User.IsInRole(Roles.Buyer))
                query = query.Where(r => r.CreatedByUserId == userId);
            else
                query = query.Where(r =>
                    r.ApprovalSteps.Any(s => s.ApproverUserId == userId));
        }

        var requests = await query
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync();

        return Ok(requests.Select(MapToDetail).ToList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/vendor-requests/history
    // Approver / FinalApprover: requests they have already acted upon
    // (i.e. they have at least one non-Pending decision in the approval chain).
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("history")]
    [Authorize(Roles = $"{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<IActionResult> GetHistory()
    {
        var userId = UserId();

        var requests = await db.VendorRequests
            .AsNoTracking()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .Where(r => r.ApprovalSteps.Any(s =>
                s.ApproverUserId == userId &&
                s.Decision != ApprovalDecision.Pending))
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync();

        return Ok(requests.Select(MapToDetail).ToList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/vendor-requests/{id}
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<IActionResult> GetById(int id)
    {
        var request = await db.VendorRequests
            .AsNoTracking()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null)
            return NotFound();

        if (!CanViewRequest(request))
            return Forbid();

        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests
    // Buyer creates a new request in Draft status.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<IActionResult> Create([FromBody] CreateVendorRequestDto dto)
    {
        var creator = await db.Users.FindAsync(UserId());

        var request = new VendorRequest
        {
            VendorName     = dto.VendorName,
            ContactPerson  = dto.ContactPerson,
            Telephone      = dto.Telephone     ?? string.Empty,
            GstNumber      = dto.GstNumber,
            PanCard        = dto.PanCard,
            AddressDetails = dto.AddressDetails,
            City           = dto.City,
            Locality       = dto.Locality,
            MaterialGroup  = dto.MaterialGroup  ?? string.Empty,
            PostalCode     = dto.PostalCode     ?? string.Empty,
            State          = dto.State          ?? string.Empty,
            Country        = dto.Country        ?? "India",
            Currency       = dto.Currency       ?? "INR",
            PaymentTerms   = dto.PaymentTerms   ?? string.Empty,
            Incoterms      = dto.Incoterms      ?? string.Empty,
            Reason         = dto.Reason         ?? string.Empty,
            YearlyPvo      = dto.YearlyPvo      ?? string.Empty,
            CreatedByUserId = UserId(),
            CreatedByName   = creator?.FullName ?? string.Empty,
            Status          = VendorRequestStatus.Draft,
        };

        // Build approval chain: each approver gets a unique StepOrder (1, 2, 3...);
        // FinalApprover is always last at stepOrder = approverCount + 1.
        int stepOrder = 1;
        foreach (var approverId in dto.ApproverUserIds)
        {
            var approver = await db.Users.FindAsync(approverId);
            request.ApprovalSteps.Add(new ApprovalStep
            {
                ApproverUserId  = approverId,
                ApproverName    = approver?.FullName ?? approverId,
                StepOrder       = stepOrder++,
                IsFinalApproval = false,
            });
        }

        var pardeep = await db.Users
            .FirstOrDefaultAsync(u => u.Email == FinalApproverRequirement.AuthorizedEmail);

        if (pardeep is null)
            return StatusCode(500, "Final Approver account not found. Contact admin.");

        request.ApprovalSteps.Add(new ApprovalStep
        {
            ApproverUserId  = pardeep.Id,
            ApproverName    = pardeep.FullName,
            StepOrder       = stepOrder,
            IsFinalApproval = true,
        });

        db.VendorRequests.Add(request);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = request.Id }, MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests/{id}/submit
    // Buyer submits a Draft request into the approval queue.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/submit")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<IActionResult> Submit(int id)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null)                          return NotFound();
        if (request.CreatedByUserId != UserId())       return Forbid();
        if (request.Status != VendorRequestStatus.Draft)
            return BadRequest("Only Draft requests can be submitted via this endpoint. Use /resubmit for Rejected requests.");

        request.Status    = VendorRequestStatus.PendingApproval;
        request.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests/{id}/resubmit
    // Buyer edits and resubmits a Rejected request.
    // Computes a field-level diff and persists a VendorRevision entry. (BRD §5)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/resubmit")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<IActionResult> Resubmit(int id, [FromBody] ResubmitRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null)                               return NotFound();
        if (request.CreatedByUserId != UserId())            return Forbid();
        if (request.Status != VendorRequestStatus.Rejected)
            return BadRequest("Only Rejected requests can be resubmitted.");

        // Compute field-level diff (same logic as the frontend RESUBMIT reducer)
        var changes = TrackedFields
            .Where(f => f.GetFromRequest(request) != f.GetFromDto(dto))
            .Select(f => new FieldChangeRecord(
                f.CamelKey, f.Label,
                f.GetFromRequest(request),
                f.GetFromDto(dto)))
            .ToList();

        var newRevNo  = request.RevisionNo + 1;
        var changedBy = await db.Users.FindAsync(UserId());

        var revision = new VendorRevision
        {
            VendorRequestId  = request.Id,
            RevisionNo       = newRevNo,
            ChangedByUserId  = UserId(),
            ChangedByName    = changedBy?.FullName ?? string.Empty,
            ChangedAt        = DateTime.UtcNow,
            RejectionComment = request.RejectionComment,
            ChangesJson      = JsonSerializer.Serialize(changes, JsonOpts),
        };
        db.VendorRevisions.Add(revision);

        // Apply updated fields
        request.VendorName    = dto.VendorName;
        request.ContactPerson = dto.ContactPerson;
        request.Telephone     = dto.Telephone     ?? string.Empty;
        request.GstNumber     = dto.GstNumber;
        request.PanCard       = dto.PanCard;
        request.AddressDetails= dto.AddressDetails;
        request.City          = dto.City;
        request.Locality      = dto.Locality;
        request.MaterialGroup = dto.MaterialGroup ?? string.Empty;
        request.PostalCode    = dto.PostalCode    ?? string.Empty;
        request.State         = dto.State         ?? string.Empty;
        request.Country       = dto.Country       ?? "India";
        request.Currency      = dto.Currency      ?? "INR";
        request.PaymentTerms  = dto.PaymentTerms  ?? string.Empty;
        request.Incoterms     = dto.Incoterms     ?? string.Empty;
        request.Reason        = dto.Reason        ?? string.Empty;
        request.YearlyPvo     = dto.YearlyPvo     ?? string.Empty;

        // Reset workflow state
        request.RevisionNo       = newRevNo;
        request.RejectionComment = null;
        request.Status           = VendorRequestStatus.PendingApproval;
        request.UpdatedAt        = DateTime.UtcNow;

        foreach (var step in request.ApprovalSteps)
        {
            step.Decision  = ApprovalDecision.Pending;
            step.Comment   = null;
            step.DecidedAt = null;
        }

        await db.SaveChangesAsync();

        request.RevisionHistory.Add(revision);
        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests/{id}/approve
    // Intermediate Approver only — FinalApprover uses /complete instead.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = Roles.Approver)]
    public async Task<IActionResult> Approve(int id, [FromBody] ApproveRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null) return NotFound();

        var step = GetPendingStepForCurrentUser(request);
        if (step is null)
            return Forbid("No pending approval step assigned to you for this request.");

        if (request.Status is not (VendorRequestStatus.PendingApproval or VendorRequestStatus.PendingFinalApproval))
            return BadRequest("Request is not in an approvable state.");

        step.Decision  = ApprovalDecision.Approved;
        step.Comment   = dto.Comment;
        step.DecidedAt = DateTime.UtcNow;

        AdvanceWorkflow(request);

        request.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests/{id}/reject
    // Approver or FinalApprover rejects with a mandatory comment.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = $"{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null) return NotFound();

        var step = GetPendingStepForCurrentUser(request);
        if (step is null)
            return Forbid("No pending approval step assigned to you for this request.");

        step.Decision  = ApprovalDecision.Rejected;
        step.Comment   = dto.Comment;
        step.DecidedAt = DateTime.UtcNow;

        request.Status           = VendorRequestStatus.Rejected;
        request.RejectionComment = dto.Comment;
        request.UpdatedAt        = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests/{id}/complete
    //
    // RESTRICTED: FinalApproverOnly policy (role + email guard).
    // Atomically approves the final step and assigns the SAP Vendor Code.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/complete")]
    [Authorize(Policy = Policies.FinalApproverOnly)]
    public async Task<IActionResult> Complete(int id, [FromBody] CompleteRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null) return NotFound();

        if (request.Status != VendorRequestStatus.PendingFinalApproval)
            return BadRequest("Request must be in PendingFinalApproval status.");

        var finalStep = GetPendingStepForCurrentUser(request);
        if (finalStep is null || !finalStep.IsFinalApproval)
            return Forbid("No pending final approval step assigned to you for this request.");

        // Atomically approve final step + assign vendor code
        finalStep.Decision  = ApprovalDecision.Approved;
        finalStep.Comment   = "Final approval granted. Vendor code assigned from SAP.";
        finalStep.DecidedAt = DateTime.UtcNow;

        request.VendorCode           = dto.VendorCode;
        request.VendorCodeAssignedAt = DateTime.UtcNow;
        request.VendorCodeAssignedBy = UserId();
        request.Status               = VendorRequestStatus.Completed;
        request.UpdatedAt            = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private string UserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Authenticated user has no NameIdentifier claim.");

    private bool CanViewRequest(VendorRequest request)
    {
        if (User.IsInRole(Roles.Admin)) return true;
        var uid = UserId();
        if (User.IsInRole(Roles.Buyer) && request.CreatedByUserId == uid) return true;
        return request.ApprovalSteps.Any(s => s.ApproverUserId == uid);
    }

    private ApprovalStep? GetPendingStepForCurrentUser(VendorRequest request)
    {
        var uid = UserId();
        return request.ApprovalSteps
            .Where(s => s.ApproverUserId == uid && s.Decision == ApprovalDecision.Pending)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefault();
    }

    private static void AdvanceWorkflow(VendorRequest request)
    {
        // A request advances to FinalApproval only when every non-final step is Approved.
        // Until then it stays in PendingApproval so remaining parallel approvers can still act.
        var nonFinalSteps = request.ApprovalSteps.Where(s => !s.IsFinalApproval).ToList();
        bool allTechnicalApproved = nonFinalSteps.Count > 0
            && nonFinalSteps.All(s => s.Decision == ApprovalDecision.Approved);

        if (allTechnicalApproved)
            request.Status = VendorRequestStatus.PendingFinalApproval;
        // else: status stays PendingApproval — other parallel approvers still need to act
    }

    private static VendorRequestDetailDto MapToDetail(VendorRequest r)
    {
        var sortedSteps = r.ApprovalSteps.OrderBy(s => s.StepOrder).ToList();

        // Parallel model: expose all users who still have a pending step relevant to the current status.
        // PendingApproval  → all non-final steps that are still Pending
        // PendingFinalApproval → the final step that is still Pending
        // Any other status → empty (nothing actionable)
        var pendingApproverUserIds = r.Status switch
        {
            VendorRequestStatus.PendingApproval =>
                sortedSteps
                    .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Pending)
                    .Select(s => s.ApproverUserId)
                    .ToList(),
            VendorRequestStatus.PendingFinalApproval =>
                sortedSteps
                    .Where(s => s.IsFinalApproval && s.Decision == ApprovalDecision.Pending)
                    .Select(s => s.ApproverUserId)
                    .ToList(),
            _ => new List<string>(),
        };

        var revisionHistory = r.RevisionHistory
            .OrderBy(v => v.RevisionNo)
            .Select(v =>
            {
                var changes = JsonSerializer
                    .Deserialize<List<FieldChangeRecord>>(v.ChangesJson, JsonOpts)
                    ?.Select(c => new FieldChangeDto(c.Field, c.FieldLabel, c.OldValue, c.NewValue))
                    .ToList() ?? [];

                return new VendorRevisionDto(
                    v.RevisionNo, v.ChangedByUserId, v.ChangedByName,
                    v.ChangedAt,  v.RejectionComment, changes);
            })
            .ToList();

        return new VendorRequestDetailDto(
            r.Id, r.VendorName, r.ContactInformation, r.ContactPerson, r.Telephone,
            r.GstNumber, r.PanCard,
            r.AddressDetails, r.City, r.Locality,
            r.MaterialGroup, r.PostalCode, r.State, r.Country,
            r.Currency, r.PaymentTerms, r.Incoterms, r.Reason, r.YearlyPvo,
            r.Status, r.RevisionNo, r.RejectionComment,
            r.VendorCode, r.VendorCodeAssignedAt, r.VendorCodeAssignedBy,
            r.CreatedByUserId, r.CreatedByName, r.CreatedAt, r.UpdatedAt,
            pendingApproverUserIds,
            sortedSteps.Select(s => new ApprovalStepDto(
                s.Id, s.ApproverUserId, s.ApproverName, s.StepOrder,
                s.Decision, s.Comment, s.DecidedAt, s.IsFinalApproval)).ToList(),
            revisionHistory);
    }
}
