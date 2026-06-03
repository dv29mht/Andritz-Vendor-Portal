using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AndritzVendorPortal.Infrastructure.Persistence.Configurations;

public class VendorRequestConfiguration : IEntityTypeConfiguration<VendorRequest>
{
    public void Configure(EntityTypeBuilder<VendorRequest> e)
    {
        e.HasKey(x => x.Id);

        e.Property(x => x.VendorName).IsRequired().HasMaxLength(200);
        e.Property(x => x.ContactPerson).HasMaxLength(100);
        e.Property(x => x.ContactInformation).HasMaxLength(200);
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
        e.Property(x => x.PurchasingOrganization).HasMaxLength(10);
        e.Property(x => x.MsmeCategory).HasMaxLength(20);
        e.Property(x => x.BankName).HasMaxLength(200);
        e.Property(x => x.BranchName).HasMaxLength(200);
        e.Property(x => x.BankAccountNumber).HasMaxLength(50);
        e.Property(x => x.IfscCode).HasMaxLength(20);
        // Document uploads — store as base64 data URIs in unbounded text column
        e.Property(x => x.BankDocument1).HasColumnType("nvarchar(max)");
        e.Property(x => x.BankDocument2).HasColumnType("nvarchar(max)");
        e.Property(x => x.GstDocument).HasColumnType("nvarchar(max)");
        e.Property(x => x.PanDocument).HasColumnType("nvarchar(max)");
        e.Property(x => x.VendorCode).HasMaxLength(50);
        e.Property(x => x.VendorCodeAssignedBy).HasMaxLength(200);
        e.Property(x => x.CreatedByName).HasMaxLength(200);
        e.Property(x => x.CreatedByUserId).HasMaxLength(450);
        e.Property(x => x.CreatedBy).HasMaxLength(450);
        e.Property(x => x.ModifiedBy).HasMaxLength(450);

        // Unique index on vendor codes. SQL Server treats NULL as equal in unique
        // indexes, so we add a filter to allow multiple unassigned (NULL) rows.
        e.HasIndex(x => x.VendorCode)
         .IsUnique()
         .HasFilter("[VendorCode] IS NOT NULL");

        e.HasMany(x => x.ApprovalSteps)
         .WithOne(s => s.VendorRequest!)
         .HasForeignKey(s => s.VendorRequestId)
         .OnDelete(DeleteBehavior.Cascade);

        e.HasMany(x => x.RevisionHistory)
         .WithOne(r => r.VendorRequest!)
         .HasForeignKey(r => r.VendorRequestId)
         .OnDelete(DeleteBehavior.Cascade);

        // Optimistic concurrency on the workflow state. Without this, two approvers
        // acting on the same request at the same instant both read PendingApproval,
        // both write, and the workflow double-advances and double-notifies. Marking
        // Status a concurrency token makes EF append "AND Status = @original" to the
        // UPDATE, so the second writer gets a DbUpdateConcurrencyException (mapped to
        // 409 in GlobalExceptionMiddleware) and must re-read before retrying. This is
        // a model-level change only — no column is added, so no schema migration.
        e.Property(x => x.Status).IsConcurrencyToken();

        e.HasIndex(x => x.Status);
        e.HasIndex(x => x.CreatedByUserId);
        e.HasIndex(x => x.IsArchived);

        // Soft-delete: archived requests are excluded from every LINQ query by default
        // so they can never leak into buyer/approver lists. Callers that legitimately
        // need archived rows (the admin grid, by-id lookups, name propagation) opt back
        // in with IgnoreQueryFilters(). FindAsync/GetByIdAsync bypass this automatically.
        e.HasQueryFilter(x => !x.IsArchived);
    }
}

public class ApprovalStepConfiguration : IEntityTypeConfiguration<ApprovalStep>
{
    public void Configure(EntityTypeBuilder<ApprovalStep> e)
    {
        e.HasKey(x => x.Id);
        e.Property(x => x.ApproverName).HasMaxLength(200);
        e.Property(x => x.ApproverUserId).HasMaxLength(450);
        e.Property(x => x.Comment).HasMaxLength(500);
        e.Property(x => x.DeletedApproverNote).HasMaxLength(500);

        e.HasIndex(x => new { x.VendorRequestId, x.StepOrder }).IsUnique();
        e.HasIndex(x => x.ApproverUserId);
    }
}

public class VendorRevisionConfiguration : IEntityTypeConfiguration<VendorRevision>
{
    public void Configure(EntityTypeBuilder<VendorRevision> e)
    {
        e.HasKey(x => x.Id);
        e.Property(x => x.ChangedByName).HasMaxLength(200);
        e.Property(x => x.ChangedByUserId).HasMaxLength(450);
        e.Property(x => x.RejectionComment).HasMaxLength(1000);
        // Unbounded JSON blob — let the provider pick (nvarchar(max) on SQL Server).
        e.Property(x => x.ChangesJson);

        e.HasIndex(x => x.VendorRequestId);
    }
}
