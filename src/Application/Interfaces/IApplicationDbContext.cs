using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Interfaces;

/// <summary>
/// Application-facing abstraction for the database context.
/// Application handlers depend on this, NOT on the concrete EF DbContext.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<VendorRequest> VendorRequests { get; }
    DbSet<ApprovalStep> ApprovalSteps { get; }
    DbSet<VendorRevision> VendorRevisions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
