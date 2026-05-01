using AndritzVendorPortal.Domain.Entities;

namespace AndritzVendorPortal.Application.Interfaces;

public interface IVendorRequestRepository : IGenericRepository<VendorRequest>
{
    Task<VendorRequest?> GetByIdWithDetailsAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<VendorRequest>> GetAllWithDetailsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<VendorRequest>> GetForBuyerAsync(string userId, CancellationToken ct = default);
    Task<IReadOnlyList<VendorRequest>> GetForApproverAsync(string userId, CancellationToken ct = default);
    Task<IReadOnlyList<VendorRequest>> GetHistoryForApproverAsync(string userId, CancellationToken ct = default);
    Task<bool> GstNumberExistsAsync(string gst, int? excludeId = null, CancellationToken ct = default);
    Task<bool> PanCardExistsAsync(string pan, int? excludeId = null, CancellationToken ct = default);
}
