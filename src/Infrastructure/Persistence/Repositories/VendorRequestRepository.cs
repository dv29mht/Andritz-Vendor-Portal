using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Infrastructure.Persistence.Repositories;

public class VendorRequestRepository(ApplicationDbContext db)
    : GenericRepository<VendorRequest>(db), IVendorRequestRepository
{
    public async Task<VendorRequest?> GetByIdWithDetailsAsync(int id, CancellationToken ct = default) =>
        await Db.VendorRequests
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<IReadOnlyList<VendorRequest>> GetAllWithDetailsAsync(CancellationToken ct = default) =>
        await Db.VendorRequests
            .AsNoTracking()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VendorRequest>> GetForBuyerAsync(string userId, CancellationToken ct = default) =>
        await Db.VendorRequests
            .AsNoTracking()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .Where(r => r.CreatedByUserId == userId)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VendorRequest>> GetForApproverAsync(string userId, CancellationToken ct = default) =>
        await Db.VendorRequests
            .AsNoTracking()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .Where(r => r.ApprovalSteps.Any(s => s.ApproverUserId == userId))
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VendorRequest>> GetHistoryForApproverAsync(string userId, CancellationToken ct = default) =>
        await Db.VendorRequests
            .AsNoTracking()
            .Include(r => r.ApprovalSteps)
            .Include(r => r.RevisionHistory)
            .Where(r => r.ApprovalSteps.Any(s =>
                s.ApproverUserId == userId &&
                s.Decision != ApprovalDecision.Pending))
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync(ct);

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
