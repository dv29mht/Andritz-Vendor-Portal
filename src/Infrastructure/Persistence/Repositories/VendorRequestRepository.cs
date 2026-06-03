using System.Linq.Expressions;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Infrastructure.Persistence.Repositories;

public class VendorRequestRepository(ApplicationDbContext db)
    : GenericRepository<VendorRequest>(db), IVendorRequestRepository
{
    // Grids never render the four nvarchar(max) document blobs (BankDocument1/2,
    // GstDocument, PanDocument), yet a request can carry several MB of base64 across
    // them. List queries project into this plain POCO so EF emits a SELECT that omits
    // those columns entirely — we neither read them from SQL nor serialize them over
    // the wire. The blobs are fetched lazily via GetByIdWithDetailsAsync when a single
    // request is opened. (Projecting into a POCO rather than the mapped entity keeps the
    // query EF-translatable; Include is ignored under a Select projection, so the child
    // collections are pulled in explicitly.)
    private sealed class ListRow
    {
        public int Id { get; init; }
        public string VendorName { get; init; } = string.Empty;
        public string ContactInformation { get; init; } = string.Empty;
        public string GstNumber { get; init; } = string.Empty;
        public string PanCard { get; init; } = string.Empty;
        public string AddressDetails { get; init; } = string.Empty;
        public string City { get; init; } = string.Empty;
        public string Locality { get; init; } = string.Empty;
        public string MaterialGroup { get; init; } = string.Empty;
        public string PostalCode { get; init; } = string.Empty;
        public string State { get; init; } = string.Empty;
        public string Country { get; init; } = string.Empty;
        public string Currency { get; init; } = string.Empty;
        public string PaymentTerms { get; init; } = string.Empty;
        public string Incoterms { get; init; } = string.Empty;
        public string ContactPerson { get; init; } = string.Empty;
        public string Telephone { get; init; } = string.Empty;
        public string Reason { get; init; } = string.Empty;
        public string YearlyPvo { get; init; } = string.Empty;
        public bool IsOneTimeVendor { get; init; }
        public string ProposedBy { get; init; } = string.Empty;
        public string PurchasingOrganization { get; init; } = string.Empty;
        public string MsmeCategory { get; init; } = string.Empty;
        public string BankName { get; init; } = string.Empty;
        public string BranchName { get; init; } = string.Empty;
        public string BankAccountNumber { get; init; } = string.Empty;
        public string IfscCode { get; init; } = string.Empty;
        public VendorRequestStatus Status { get; init; }
        public int RevisionNo { get; init; }
        public string? RejectionComment { get; init; }
        public string? VendorCode { get; init; }
        public DateTime? VendorCodeAssignedAt { get; init; }
        public string? VendorCodeAssignedBy { get; init; }
        public bool IsArchived { get; init; }
        public DateTime? ArchivedAt { get; init; }
        public string CreatedByUserId { get; init; } = string.Empty;
        public string CreatedByName { get; init; } = string.Empty;
        public DateTime CreatedAt { get; init; }
        public DateTime UpdatedAt { get; init; }
        public List<ApprovalStep> ApprovalSteps { get; init; } = [];
        public List<VendorRevision> RevisionHistory { get; init; } = [];

        public VendorRequest ToEntity() => new()
        {
            Id = Id,
            VendorName = VendorName,
            ContactInformation = ContactInformation,
            GstNumber = GstNumber,
            PanCard = PanCard,
            AddressDetails = AddressDetails,
            City = City,
            Locality = Locality,
            MaterialGroup = MaterialGroup,
            PostalCode = PostalCode,
            State = State,
            Country = Country,
            Currency = Currency,
            PaymentTerms = PaymentTerms,
            Incoterms = Incoterms,
            ContactPerson = ContactPerson,
            Telephone = Telephone,
            Reason = Reason,
            YearlyPvo = YearlyPvo,
            IsOneTimeVendor = IsOneTimeVendor,
            ProposedBy = ProposedBy,
            PurchasingOrganization = PurchasingOrganization,
            MsmeCategory = MsmeCategory,
            BankName = BankName,
            BranchName = BranchName,
            BankAccountNumber = BankAccountNumber,
            IfscCode = IfscCode,
            Status = Status,
            RevisionNo = RevisionNo,
            RejectionComment = RejectionComment,
            VendorCode = VendorCode,
            VendorCodeAssignedAt = VendorCodeAssignedAt,
            VendorCodeAssignedBy = VendorCodeAssignedBy,
            IsArchived = IsArchived,
            ArchivedAt = ArchivedAt,
            CreatedByUserId = CreatedByUserId,
            CreatedByName = CreatedByName,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt,
            ApprovalSteps = ApprovalSteps,
            RevisionHistory = RevisionHistory,
        };
    }

    private static readonly Expression<Func<VendorRequest, ListRow>> ToListRow = r => new ListRow
    {
        Id = r.Id,
        VendorName = r.VendorName,
        ContactInformation = r.ContactInformation,
        GstNumber = r.GstNumber,
        PanCard = r.PanCard,
        AddressDetails = r.AddressDetails,
        City = r.City,
        Locality = r.Locality,
        MaterialGroup = r.MaterialGroup,
        PostalCode = r.PostalCode,
        State = r.State,
        Country = r.Country,
        Currency = r.Currency,
        PaymentTerms = r.PaymentTerms,
        Incoterms = r.Incoterms,
        ContactPerson = r.ContactPerson,
        Telephone = r.Telephone,
        Reason = r.Reason,
        YearlyPvo = r.YearlyPvo,
        IsOneTimeVendor = r.IsOneTimeVendor,
        ProposedBy = r.ProposedBy,
        PurchasingOrganization = r.PurchasingOrganization,
        MsmeCategory = r.MsmeCategory,
        BankName = r.BankName,
        BranchName = r.BranchName,
        BankAccountNumber = r.BankAccountNumber,
        IfscCode = r.IfscCode,
        Status = r.Status,
        RevisionNo = r.RevisionNo,
        RejectionComment = r.RejectionComment,
        VendorCode = r.VendorCode,
        VendorCodeAssignedAt = r.VendorCodeAssignedAt,
        VendorCodeAssignedBy = r.VendorCodeAssignedBy,
        IsArchived = r.IsArchived,
        ArchivedAt = r.ArchivedAt,
        CreatedByUserId = r.CreatedByUserId,
        CreatedByName = r.CreatedByName,
        CreatedAt = r.CreatedAt,
        UpdatedAt = r.UpdatedAt,
        ApprovalSteps = r.ApprovalSteps.ToList(),
        RevisionHistory = r.RevisionHistory.ToList(),
    };

    private static async Task<IReadOnlyList<VendorRequest>> MaterializeListAsync(IQueryable<VendorRequest> query, CancellationToken ct)
    {
        var rows = await query
            .Select(ToListRow)
            .OrderByDescending(x => x.UpdatedAt)
            .AsSplitQuery()
            .ToListAsync(ct);
        return rows.Select(x => x.ToEntity()).ToList();
    }

    // By-id lookups always resolve regardless of archived state — every command that
    // loads through here enforces its own status guard, and restore needs the archived row.
    public async Task<VendorRequest?> GetByIdWithDetailsAsync(int id, CancellationToken ct = default) =>
        await Db.VendorRequests
            .IgnoreQueryFilters()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    // Admin/Final-Approver grid — includes archived so the "Archived" tab has data.
    public Task<IReadOnlyList<VendorRequest>> GetAllWithDetailsAsync(CancellationToken ct = default) =>
        MaterializeListAsync(Db.VendorRequests.IgnoreQueryFilters().AsNoTracking(), ct);

    public Task<IReadOnlyList<VendorRequest>> GetForBuyerAsync(string userId, CancellationToken ct = default) =>
        MaterializeListAsync(Db.VendorRequests.AsNoTracking().Where(r => r.CreatedByUserId == userId), ct);

    public Task<IReadOnlyList<VendorRequest>> GetForApproverAsync(string userId, CancellationToken ct = default) =>
        MaterializeListAsync(Db.VendorRequests.AsNoTracking().Where(r => r.ApprovalSteps.Any(s => s.ApproverUserId == userId)), ct);

    public Task<IReadOnlyList<VendorRequest>> GetHistoryForApproverAsync(string userId, CancellationToken ct = default) =>
        MaterializeListAsync(
            Db.VendorRequests.AsNoTracking().Where(r => r.ApprovalSteps.Any(s =>
                s.ApproverUserId == userId &&
                s.Decision != ApprovalDecision.Pending)),
            ct);

    public async Task<bool> GstNumberExistsAsync(string gst, int? excludeId = null, CancellationToken ct = default) =>
        await Db.VendorRequests.AnyAsync(r =>
            !r.IsArchived &&
            r.Status != VendorRequestStatus.Rejected &&
            r.GstNumber == gst &&
            (excludeId == null || r.Id != excludeId), ct);

    public async Task<bool> PanCardExistsAsync(string pan, int? excludeId = null, CancellationToken ct = default) =>
        await Db.VendorRequests.AnyAsync(r =>
            !r.IsArchived &&
            r.Status != VendorRequestStatus.Rejected &&
            r.PanCard == pan &&
            (excludeId == null || r.Id != excludeId), ct);
}
