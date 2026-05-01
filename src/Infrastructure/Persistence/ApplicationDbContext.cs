using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Common;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Infrastructure.Persistence;

public class ApplicationDbContext(
    DbContextOptions<ApplicationDbContext> options,
    ICurrentUserService? currentUser = null,
    IDateTimeProvider? clock = null)
    : IdentityDbContext<ApplicationUser>(options), IApplicationDbContext
{
    public DbSet<VendorRequest> VendorRequests => Set<VendorRequest>();
    public DbSet<ApprovalStep> ApprovalSteps => Set<ApprovalStep>();
    public DbSet<VendorRevision> VendorRevisions => Set<VendorRevision>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampAuditFields();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void StampAuditFields()
    {
        var now = clock?.UtcNow ?? DateTime.UtcNow;
        var user = currentUser?.UserId;

        foreach (var entry in ChangeTracker.Entries<IAuditable>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    if (user is not null) entry.Entity.CreatedBy = user;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    if (user is not null) entry.Entity.ModifiedBy = user;
                    break;
            }
        }
    }
}
