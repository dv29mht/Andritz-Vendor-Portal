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
            e.Property(x => x.ContactPerson).HasMaxLength(100);
            e.Property(x => x.Telephone).HasMaxLength(30);
            e.Property(x => x.GstNumber).HasMaxLength(15);
            e.Property(x => x.PanCard).HasMaxLength(10);
            e.Property(x => x.AddressDetails).HasMaxLength(500);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.Locality).HasMaxLength(100);
            e.Property(x => x.MaterialGroup).HasMaxLength(200);
            e.Property(x => x.PostalCode).HasMaxLength(10);
            e.Property(x => x.State).HasMaxLength(100);
            e.Property(x => x.Country).HasMaxLength(100);
            e.Property(x => x.Currency).HasMaxLength(10);
            e.Property(x => x.PaymentTerms).HasMaxLength(200);
            e.Property(x => x.Incoterms).HasMaxLength(200);
            e.Property(x => x.Reason).HasMaxLength(1000);
            e.Property(x => x.YearlyPvo).HasMaxLength(100);
            e.Property(x => x.ProposedBy).HasMaxLength(200);
            e.Property(x => x.VendorCode).HasMaxLength(50);
            e.Property(x => x.VendorCodeAssignedBy).HasMaxLength(200);
            e.Property(x => x.CreatedByName).HasMaxLength(200);

            // Partial unique index: vendor codes must be unique, but only among non-null values.
            // Fixes the TOCTOU race condition on concurrent Complete calls.
            e.HasIndex(x => x.VendorCode)
             .IsUnique()
             .HasFilter("\"VendorCode\" IS NOT NULL");

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
            e.HasIndex(x => x.ApproverUserId);   // speeds up pending-step lookups
        });

        builder.Entity<VendorRevision>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.ChangedByName).HasMaxLength(200);
            // No explicit column type — SQLite uses TEXT, SQL Server would use nvarchar(max)
        });
    }
}
