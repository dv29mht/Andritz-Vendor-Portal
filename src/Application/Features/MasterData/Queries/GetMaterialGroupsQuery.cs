using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.MasterData.Queries;

public record GetMaterialGroupsQuery() : IRequest<List<string>>;

public class GetMaterialGroupsQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetMaterialGroupsQuery, List<string>>
{
    public async Task<List<string>> Handle(GetMaterialGroupsQuery request, CancellationToken ct) =>
        await db.VendorRequests
            .AsNoTracking()
            .Where(r => r.MaterialGroup != null && r.MaterialGroup != string.Empty)
            .Select(r => r.MaterialGroup)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(ct);
}

public record GetProposedByNamesQuery() : IRequest<List<string>>;

public class GetProposedByNamesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetProposedByNamesQuery, List<string>>
{
    public async Task<List<string>> Handle(GetProposedByNamesQuery request, CancellationToken ct) =>
        await db.VendorRequests
            .AsNoTracking()
            .Where(r => r.ProposedBy != null && r.ProposedBy != string.Empty)
            .Select(r => r.ProposedBy)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(ct);
}
