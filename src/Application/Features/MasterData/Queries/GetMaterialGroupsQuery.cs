using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AndritzVendorPortal.Application.Features.MasterData.Queries;

// These dropdowns are recomputed (full-table DISTINCT, no supporting index) on every
// console mount even though the value set barely changes. A short-lived cache turns a
// table scan per page load into one scan every few minutes.
internal static class MasterDataCache
{
    public const string MaterialGroupsKey = "master-data:material-groups";
    public const string ProposedByKey = "master-data:proposed-by";
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
}

public record GetMaterialGroupsQuery() : IRequest<List<string>>;

public class GetMaterialGroupsQueryHandler(IApplicationDbContext db, IMemoryCache cache)
    : IRequestHandler<GetMaterialGroupsQuery, List<string>>
{
    public async Task<List<string>> Handle(GetMaterialGroupsQuery request, CancellationToken ct) =>
        await cache.GetOrCreateAsync(MasterDataCache.MaterialGroupsKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = MasterDataCache.Ttl;
            return await db.VendorRequests
                .AsNoTracking()
                .Where(r => r.MaterialGroup != null && r.MaterialGroup != string.Empty)
                .Select(r => r.MaterialGroup)
                .Distinct()
                .OrderBy(x => x)
                .ToListAsync(ct);
        }) ?? [];
}

public record GetProposedByNamesQuery() : IRequest<List<string>>;

public class GetProposedByNamesQueryHandler(IApplicationDbContext db, IMemoryCache cache)
    : IRequestHandler<GetProposedByNamesQuery, List<string>>
{
    public async Task<List<string>> Handle(GetProposedByNamesQuery request, CancellationToken ct) =>
        await cache.GetOrCreateAsync(MasterDataCache.ProposedByKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = MasterDataCache.Ttl;
            return await db.VendorRequests
                .AsNoTracking()
                .Where(r => r.ProposedBy != null && r.ProposedBy != string.Empty)
                .Select(r => r.ProposedBy)
                .Distinct()
                .OrderBy(x => x)
                .ToListAsync(ct);
        }) ?? [];
}
