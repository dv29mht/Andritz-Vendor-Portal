using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AndritzVendorPortal.Infrastructure.Persistence.Configurations;

public class OutboxEmailConfiguration : IEntityTypeConfiguration<OutboxEmail>
{
    public void Configure(EntityTypeBuilder<OutboxEmail> e)
    {
        e.HasKey(x => x.Id);

        e.Property(x => x.ToEmail).IsRequired().HasMaxLength(320);
        e.Property(x => x.Subject).IsRequired().HasMaxLength(500);
        // Rendered HTML body — unbounded (nvarchar(max) on SQL Server).
        e.Property(x => x.BodyHtml).IsRequired();
        e.Property(x => x.LastError).HasMaxLength(2000);

        // No FK to VendorRequest: a discarded draft must not cascade-delete the mail that
        // announced it, and the dispatcher already tolerates a request that has gone away.
        e.Property(x => x.AttachVendorRequestId);

        // The dispatcher's only hot query is "pending, due now, oldest first". The filtered
        // index covers it and stays tiny — sent rows (the overwhelming majority over time)
        // are excluded from the index entirely. Identifiers are left unquoted so the predicate
        // is valid both as a SQL Server filtered index and as a SQLite partial index (the tests
        // build the real schema on SQLite).
        e.HasIndex(x => new { x.NextAttemptAt, x.Id })
         .HasFilter("SentAt IS NULL AND IsAbandoned = 0");
    }
}
