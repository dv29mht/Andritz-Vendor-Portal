using AndritzVendorPortal.API.Data;
using AndritzVendorPortal.API.DTOs;
using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using static AndritzVendorPortal.API.Infrastructure.EmailTemplates;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/vendor-requests")]
[Authorize]
public class VendorRequestController(
    ApplicationDbContext db,
    IEmailService email,
    IConfiguration config) : ControllerBase
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
        new("proposedBy",    "Proposed By",    r => r.ProposedBy    ?? string.Empty, d => d.ProposedBy    ?? string.Empty),
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
        // Batch-load all candidate approver users in a single WHERE Id IN (...) query
        var approverIds = dto.ApproverUserIds.Distinct().ToList();
        var approverMap = await db.Users
            .Where(u => approverIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        // Validate existence in-memory
        foreach (var approverId in approverIds)
            if (!approverMap.ContainsKey(approverId))
                return BadRequest($"Approver ID '{approverId}' does not exist.");

        // Batch-check roles: one query to get the Approver role ID, one join query
        var approverRoleId = await db.Roles
            .Where(r => r.Name == Roles.Approver)
            .Select(r => r.Id)
            .FirstOrDefaultAsync();

        var usersWithApproverRole = (await db.UserRoles
            .Where(ur => approverIds.Contains(ur.UserId) && ur.RoleId == approverRoleId)
            .Select(ur => ur.UserId)
            .ToListAsync())
            .ToHashSet();

        foreach (var approverId in approverIds)
            if (!usersWithApproverRole.Contains(approverId))
                return BadRequest($"User '{approverMap[approverId].FullName}' does not have the Approver role.");

        var creator = await db.Users.FindAsync(UserId());

        var request = new VendorRequest
        {
            CreatedByUserId = UserId(),
            CreatedByName   = creator?.FullName ?? string.Empty,
            Status          = VendorRequestStatus.Draft,
        };

        // Convert to ResubmitRequestDto shape to reuse ApplyVendorFields
        ApplyVendorFields(request, new ResubmitRequestDto(
            dto.VendorName, dto.ContactPerson, dto.Telephone,
            dto.GstNumber, dto.PanCard, dto.AddressDetails,
            dto.City, dto.Locality, dto.MaterialGroup, dto.PostalCode,
            dto.State, dto.Country, dto.Currency, dto.PaymentTerms,
            dto.Incoterms, dto.Reason, dto.YearlyPvo,
            dto.IsOneTimeVendor, dto.ProposedBy, null));

        // Build approval chain: each approver gets a unique StepOrder (1, 2, 3...);
        // FinalApprover is always last at stepOrder = approverCount + 1.
        // approverMap already loaded above — no further DB hits needed.
        int stepOrder = 1;
        foreach (var approverId in dto.ApproverUserIds)
        {
            var approver = approverMap[approverId];
            request.ApprovalSteps.Add(new ApprovalStep
            {
                ApproverUserId  = approverId,
                ApproverName    = approver.FullName,
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

        // Notify first approver(s) + admin
        var adminEmail = await AdminEmailAsync();
        var firstStep  = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval).OrderBy(s => s.StepOrder).FirstOrDefault();
        if (firstStep is not null)
        {
            var approverEmail = await db.Users
                .Where(u => u.Id == firstStep.ApproverUserId)
                .Select(u => u.Email!)
                .FirstOrDefaultAsync();
            if (approverEmail is not null)
                await SendEmailAsync(
                    approverEmail,
                    NewSubmission(ToSummary(request), firstStep.ApproverName, PortalUrl()),
                    adminEmail);
        }

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

        // ── Chain integrity check ────────────────────────────────────────────
        // Find intermediate (non-final) approver steps and verify each user
        // still exists. A deleted approver has no user record.
        var intermediateSteps = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval)
            .OrderBy(s => s.StepOrder)
            .ToList();

        var existingUserIds = intermediateSteps.Count > 0
            ? (await db.Users
                .Where(u => intermediateSteps.Select(s => s.ApproverUserId).Contains(u.Id))
                .Select(u => u.Id)
                .ToListAsync())
              .ToHashSet()
            : new HashSet<string>();

        var staleApprovers = intermediateSteps
            .Where(s => !existingUserIds.Contains(s.ApproverUserId))
            .Select(s => s.ApproverName)
            .ToList();

        if (staleApprovers.Count > 0 && (dto.ApproverUserIds is null || dto.ApproverUserIds.Count == 0))
        {
            // Buyer must supply a new chain — return 409 with names of deleted approvers
            return Conflict(new
            {
                message      = "One or more approvers in the original chain no longer exist. Please provide a new approval chain.",
                staleApprovers,
            });
        }

        // ── If a new chain was supplied, validate and replace ────────────────
        if (dto.ApproverUserIds is { Count: > 0 })
        {
            var newApproverIds = dto.ApproverUserIds.Distinct().ToList();

            var approverRoleId = await db.Roles
                .Where(r => r.Name == Roles.Approver)
                .Select(r => r.Id)
                .FirstOrDefaultAsync();

            var approverMap = await db.Users
                .Where(u => newApproverIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id);

            foreach (var aid in newApproverIds)
                if (!approverMap.ContainsKey(aid))
                    return BadRequest($"Approver ID '{aid}' does not exist.");

            var usersWithRole = (await db.UserRoles
                .Where(ur => newApproverIds.Contains(ur.UserId) && ur.RoleId == approverRoleId)
                .Select(ur => ur.UserId)
                .ToListAsync())
                .ToHashSet();

            foreach (var aid in newApproverIds)
                if (!usersWithRole.Contains(aid))
                    return BadRequest($"User '{approverMap[aid].FullName}' does not have the Approver role.");

            // Remove old intermediate steps and replace with new ones
            var finalStep = request.ApprovalSteps.First(s => s.IsFinalApproval);
            db.ApprovalSteps.RemoveRange(intermediateSteps);

            int stepOrder = 1;
            foreach (var aid in newApproverIds)
            {
                request.ApprovalSteps.Add(new ApprovalStep
                {
                    ApproverUserId  = aid,
                    ApproverName    = approverMap[aid].FullName,
                    StepOrder       = stepOrder++,
                    IsFinalApproval = false,
                });
            }

            // Keep final step's order consistent
            finalStep.StepOrder = stepOrder;
            finalStep.Decision  = ApprovalDecision.Pending;
            finalStep.Comment   = null;
            finalStep.DecidedAt = null;
        }
        else
        {
            // Reuse original chain — just reset decisions
            foreach (var step in request.ApprovalSteps)
            {
                step.Decision  = ApprovalDecision.Pending;
                step.Comment   = null;
                step.DecidedAt = null;
            }
        }

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

        ApplyVendorFields(request, dto);

        request.RevisionNo       = newRevNo;
        request.RejectionComment = null;
        request.Status           = VendorRequestStatus.PendingApproval;
        request.UpdatedAt        = DateTime.UtcNow;

        await db.SaveChangesAsync();

        // Notify first approver + admin that the buyer has resubmitted
        var adminEmailRs = await AdminEmailAsync();
        var firstStepRs  = request.ApprovalSteps
            .Where(s => !s.IsFinalApproval).OrderBy(s => s.StepOrder).FirstOrDefault();
        if (firstStepRs is not null)
        {
            var approverEmailRs = await db.Users
                .Where(u => u.Id == firstStepRs.ApproverUserId)
                .Select(u => u.Email!)
                .FirstOrDefaultAsync();
            if (approverEmailRs is not null)
                await SendEmailAsync(
                    approverEmailRs,
                    Resubmitted(ToSummary(request), firstStepRs.ApproverName, PortalUrl()),
                    adminEmailRs);
        }

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

        if (request.Status != VendorRequestStatus.PendingApproval)
            return BadRequest("Request is not in an approvable state. Use /complete for final approval.");

        step.Decision  = ApprovalDecision.Approved;
        step.Comment   = dto.Comment;
        step.DecidedAt = DateTime.UtcNow;

        AdvanceWorkflow(request);

        request.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var adminEmailAp  = await AdminEmailAsync();
        var buyerEmailAp  = await db.Users
            .Where(u => u.Id == request.CreatedByUserId).Select(u => u.Email!).FirstOrDefaultAsync();
        var summary       = ToSummary(request);
        var url           = PortalUrl();

        if (request.Status == VendorRequestStatus.PendingFinalApproval)
        {
            // All intermediate steps done — notify FinalApprover + admin
            var finalStep     = request.ApprovalSteps.FirstOrDefault(s => s.IsFinalApproval);
            var pardeepEmail  = await db.Users
                .Where(u => u.Id == (finalStep!.ApproverUserId))
                .Select(u => u.Email!)
                .FirstOrDefaultAsync();
            if (pardeepEmail is not null)
                await SendEmailAsync(pardeepEmail, ReadyForFinalApproval(summary, url), adminEmailAp);
        }
        else
        {
            // Still more intermediate approvers — notify buyer + next approver + admin
            var nextStep = request.ApprovalSteps
                .Where(s => !s.IsFinalApproval && s.Decision == ApprovalDecision.Pending)
                .OrderBy(s => s.StepOrder).FirstOrDefault();
            var (apSubject, apBody) = StepApproved(summary, step.ApproverName, nextStep?.ApproverName, url);

            var recipients = new HashSet<string>();
            if (buyerEmailAp is not null)  recipients.Add(buyerEmailAp);
            if (adminEmailAp is not null)  recipients.Add(adminEmailAp);
            if (nextStep is not null)
            {
                var nextEmail = await db.Users
                    .Where(u => u.Id == nextStep.ApproverUserId).Select(u => u.Email!).FirstOrDefaultAsync();
                if (nextEmail is not null) recipients.Add(nextEmail);
            }

            foreach (var r in recipients)
                await email.SendAsync(r, apSubject, apBody);
        }

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

        // Notify buyer + admin of rejection
        var buyerEmailRj = await db.Users
            .Where(u => u.Id == request.CreatedByUserId).Select(u => u.Email!).FirstOrDefaultAsync();
        var adminEmailRj = await AdminEmailAsync();
        var (rjSubject, rjBody) = Rejected(ToSummary(request), step.ApproverName, dto.Comment, PortalUrl());
        if (buyerEmailRj is not null)
            await email.SendAsync(buyerEmailRj, rjSubject, rjBody);
        if (adminEmailRj is not null && adminEmailRj != buyerEmailRj)
            await email.SendAsync(adminEmailRj, rjSubject, rjBody);

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
        // (uniqueness enforced by DB partial unique index; DbUpdateException caught below)
        finalStep.Decision  = ApprovalDecision.Approved;
        finalStep.Comment   = "Final approval granted. Vendor code assigned from SAP.";
        finalStep.DecidedAt = DateTime.UtcNow;

        request.VendorCode           = dto.VendorCode;
        request.VendorCodeAssignedAt = DateTime.UtcNow;
        request.VendorCodeAssignedBy = finalStep.ApproverName;   // store name, not ID
        request.Status               = VendorRequestStatus.Completed;
        request.UpdatedAt            = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Unique constraint violation: two concurrent Complete calls raced
            return Conflict($"Vendor code '{dto.VendorCode}' was just assigned by a concurrent request. Use a different code.");
        }

        // Notify buyer + admin that onboarding is complete with the SAP code
        var buyerEmailCo = await db.Users
            .Where(u => u.Id == request.CreatedByUserId).Select(u => u.Email!).FirstOrDefaultAsync();
        var adminEmailCo = await AdminEmailAsync();
        var (coSubject, coBody) = Completed(ToSummary(request), dto.VendorCode, finalStep.ApproverName, PortalUrl());
        if (buyerEmailCo is not null)
            await email.SendAsync(buyerEmailCo, coSubject, coBody);
        if (adminEmailCo is not null && adminEmailCo != buyerEmailCo)
            await email.SendAsync(adminEmailCo, coSubject, coBody);

        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/vendor-requests/{id}
    // Admin-only: edit any field on a Completed request.
    // Creates a VendorRevision entry for audit trail (BRD §5).
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> AdminEdit(int id, [FromBody] AdminEditVendorRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null) return NotFound();

        if (request.Status != VendorRequestStatus.Completed)
            return BadRequest("Only completed (SAP-approved) requests can be edited by Admin.");

        // Convert AdminEditDto to ResubmitRequestDto to reuse TrackedFields diff logic
        var asResubmit = new ResubmitRequestDto(
            dto.VendorName, dto.ContactPerson, dto.Telephone,
            dto.GstNumber, dto.PanCard, dto.AddressDetails,
            dto.City, dto.Locality, dto.MaterialGroup, dto.PostalCode,
            dto.State, dto.Country, dto.Currency, dto.PaymentTerms,
            dto.Incoterms, dto.Reason, dto.YearlyPvo,
            dto.IsOneTimeVendor, dto.ProposedBy, null);

        // Compute field-level diff before applying changes
        var changes = TrackedFields
            .Where(f => f.GetFromRequest(request) != f.GetFromDto(asResubmit))
            .Select(f => new FieldChangeRecord(
                f.CamelKey, f.Label,
                f.GetFromRequest(request),
                f.GetFromDto(asResubmit)))
            .ToList();

        // Only create a revision entry if something actually changed
        if (changes.Count > 0)
        {
            var newRevNo  = request.RevisionNo + 1;
            var adminUser = await db.Users.FindAsync(UserId());

            var revision = new VendorRevision
            {
                VendorRequestId  = request.Id,
                RevisionNo       = newRevNo,
                ChangedByUserId  = UserId(),
                ChangedByName    = adminUser?.FullName ?? string.Empty,
                ChangedAt        = DateTime.UtcNow,
                RejectionComment = null,
                ChangesJson      = JsonSerializer.Serialize(changes, JsonOpts),
            };
            db.VendorRevisions.Add(revision);
            request.RevisionNo = newRevNo;
        }

        ApplyVendorFields(request, asResubmit);
        request.IsOneTimeVendor = dto.IsOneTimeVendor ?? request.IsOneTimeVendor;
        request.UpdatedAt       = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/vendor-requests/{id}/buyer-update
    // Buyer updates a Completed request after SAP code is assigned.
    // Status stays Completed; vendor code is preserved.
    // Records a revision entry so FinalApprover/Admin can see what changed.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("{id:int}/buyer-update")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<IActionResult> BuyerUpdateCompleted(int id, [FromBody] ResubmitRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null)                             return NotFound();
        if (request.CreatedByUserId != UserId())          return Forbid();
        if (request.Status != VendorRequestStatus.Completed)
            return BadRequest("Only Completed requests can be updated via this endpoint.");

        var changes = TrackedFields
            .Where(f => f.GetFromRequest(request) != f.GetFromDto(dto))
            .Select(f => new FieldChangeRecord(
                f.CamelKey, f.Label,
                f.GetFromRequest(request),
                f.GetFromDto(dto)))
            .ToList();

        // Only create a revision entry if something actually changed
        VendorRevision? revision = null;
        if (changes.Count > 0)
        {
            var newRevNo  = request.RevisionNo + 1;
            var changedBy = await db.Users.FindAsync(UserId());

            revision = new VendorRevision
            {
                VendorRequestId  = request.Id,
                RevisionNo       = newRevNo,
                ChangedByUserId  = UserId(),
                ChangedByName    = changedBy?.FullName ?? string.Empty,
                ChangedAt        = DateTime.UtcNow,
                RejectionComment = null,
                ChangesJson      = JsonSerializer.Serialize(changes, JsonOpts),
            };
            db.VendorRevisions.Add(revision);
            request.RevisionNo = newRevNo;
        }

        ApplyVendorFields(request, dto);

        // Status stays Completed; VendorCode stays assigned
        request.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        if (revision is not null)
            request.RevisionHistory.Add(revision);
        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/vendor-requests/{id}/classify
    // Admin-only: toggle permanent ↔ one-time on a Completed request.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPatch("{id:int}/classify")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Classify(int id, [FromBody] ClassifyVendorRequestDto dto)
    {
        var request = await db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (request is null) return NotFound();
        if (request.Status != VendorRequestStatus.Completed)
            return BadRequest("Only completed requests can be reclassified.");

        request.IsOneTimeVendor = dto.IsOneTimeVendor;
        request.UpdatedAt       = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(MapToDetail(request));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /api/vendor-requests/{id}
    // Admin-only: soft-delete (archive) a request — record is retained in the DB
    // and can be restored. Only Rejected or Completed requests may be archived.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
    {
        var request = await db.VendorRequests.FindAsync(id);

        if (request is null) return NotFound();

        if (request.Status != VendorRequestStatus.Rejected &&
            request.Status != VendorRequestStatus.Completed)
            return BadRequest("Only Rejected or Completed requests can be archived.");

        request.IsArchived = true;
        request.ArchivedAt = DateTime.UtcNow;
        request.UpdatedAt  = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return NoContent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/vendor-requests/{id}/restore
    // Admin-only: undo an archive — makes the record visible again.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/restore")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Restore(int id)
    {
        var request = await db.VendorRequests.FindAsync(id);
        if (request is null) return NotFound();

        request.IsArchived = false;
        request.ArchivedAt = null;
        request.UpdatedAt  = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return NoContent();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private string UserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Authenticated user has no NameIdentifier claim.");

    private string PortalUrl() =>
        config["PortalUrl"] ?? "https://andritz-portal-live.vercel.app";

    private async Task<string?> AdminEmailAsync() =>
        await db.Users
            .Where(u => u.Email == "admin@andritz.com" && !u.IsArchived)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();

    private static VendorSummary ToSummary(VendorRequest r) => new(
        r.Id, r.VendorName, r.MaterialGroup, r.GstNumber, r.PanCard,
        r.City, r.State, r.Country, r.CreatedByName, r.RevisionNo);

    /// <summary>
    /// Sends an email to <paramref name="to"/> (and optionally admin) without blocking.
    /// Errors are already swallowed inside SmtpEmailService.
    /// </summary>
    private async Task SendEmailAsync(
        string to, (string Subject, string Body) template,
        string? alsoNotifyAdmin = null)
    {
        await email.SendAsync(to, template.Subject, template.Body);
        if (alsoNotifyAdmin is not null && alsoNotifyAdmin != to)
            await email.SendAsync(alsoNotifyAdmin, template.Subject, template.Body);
    }

    private bool CanViewRequest(VendorRequest request)
    {
        if (User.IsInRole(Roles.Admin)) return true;
        var uid = UserId();
        if (User.IsInRole(Roles.Buyer) && request.CreatedByUserId == uid) return true;
        return request.ApprovalSteps.Any(s => s.ApproverUserId == uid);
    }

    private ApprovalStep? GetPendingStepForCurrentUser(VendorRequest request) =>
        ApprovalChain.GetPendingStepForUser(request.ApprovalSteps, UserId());

    private static void AdvanceWorkflow(VendorRequest request) =>
        ApprovalChain.AdvanceWorkflow(request);

    /// <summary>
    /// Applies all vendor detail fields from <paramref name="d"/> onto <paramref name="r"/>.
    /// Single source of truth — used by Create, Resubmit, AdminEdit, and BuyerUpdateCompleted
    /// to avoid 4× duplicated field-assignment blocks.
    /// </summary>
    private static void ApplyVendorFields(VendorRequest r, ResubmitRequestDto d)
    {
        r.VendorName     = d.VendorName;
        r.ContactPerson  = d.ContactPerson;
        r.Telephone      = d.Telephone      ?? string.Empty;
        r.GstNumber      = d.GstNumber;
        r.PanCard        = d.PanCard;
        r.AddressDetails = d.AddressDetails;
        r.City           = d.City;
        r.Locality       = d.Locality;
        r.MaterialGroup  = d.MaterialGroup  ?? string.Empty;
        r.PostalCode     = d.PostalCode     ?? string.Empty;
        r.State          = d.State          ?? string.Empty;
        r.Country        = d.Country        ?? "India";
        r.Currency       = d.Currency       ?? "INR";
        r.PaymentTerms   = d.PaymentTerms   ?? string.Empty;
        r.Incoterms      = d.Incoterms      ?? string.Empty;
        r.Reason         = d.Reason         ?? string.Empty;
        r.YearlyPvo      = d.YearlyPvo      ?? string.Empty;
        r.IsOneTimeVendor= d.IsOneTimeVendor ?? false;
        r.ProposedBy     = d.ProposedBy     ?? string.Empty;
    }

    private static VendorRequestDetailDto MapToDetail(VendorRequest r)
    {
        var sortedSteps = r.ApprovalSteps.OrderBy(s => s.StepOrder).ToList();

        // Sequential chain: only the NEXT approver (lowest StepOrder) is active at a time.
        // Deleted-approver steps are auto-skipped and never surface as pending.
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
}
