using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.API.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<VendorRequest>  VendorRequests  => Set<VendorRequest>();
    public DbSet<ApprovalStep>   ApprovalSteps   => Set<ApprovalStep>();
    public DbSet<VendorRevision> VendorRevisions => Set<VendorRevision>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<VendorRequest>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.VendorName).IsRequired().HasMaxLength(200);
            e.Property(x => x.GstNumber).HasMaxLength(15);
            e.Property(x => x.PanCard).HasMaxLength(10);
            e.Property(x => x.VendorCode).HasMaxLength(50);
            e.Property(x => x.CreatedByName).HasMaxLength(200);

            e.HasOne(x => x.CreatedBy)
             .WithMany(u => u.CreatedRequests)
             .HasForeignKey(x => x.CreatedByUserId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasMany(x => x.ApprovalSteps)
             .WithOne(s => s.VendorRequest)
             .HasForeignKey(s => s.VendorRequestId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(x => x.RevisionHistory)
             .WithOne(r => r.VendorRequest)
             .HasForeignKey(r => r.VendorRequestId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ApprovalStep>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ApproverName).HasMaxLength(200);
            e.HasIndex(x => new { x.VendorRequestId, x.StepOrder }).IsUnique();
        });

        builder.Entity<VendorRevision>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ChangedByName).HasMaxLength(200);
            // No explicit column type — SQLite uses TEXT, SQL Server would use nvarchar(max)
        });
    }
}
