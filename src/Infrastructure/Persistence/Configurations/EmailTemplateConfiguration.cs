using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AndritzVendorPortal.Infrastructure.Persistence.Configurations;

public class EmailTemplateConfiguration : IEntityTypeConfiguration<EmailTemplate>
{
    public void Configure(EntityTypeBuilder<EmailTemplate> e)
    {
        e.HasKey(x => x.Id);

        e.Property(x => x.Code).IsRequired().HasMaxLength(100);
        e.Property(x => x.Name).IsRequired().HasMaxLength(200);
        e.Property(x => x.Subject).IsRequired().HasMaxLength(300);
        // Bodies are unbounded — let the provider pick the right type (longtext on MySQL,
        // nvarchar(max) on SQL Server) instead of pinning to a specific type string.
        e.Property(x => x.BodyText).IsRequired();
        e.Property(x => x.DefaultSubject).IsRequired().HasMaxLength(300);
        e.Property(x => x.DefaultBodyText).IsRequired();
        e.Property(x => x.Placeholders).HasMaxLength(1000);
        e.Property(x => x.Audience).HasMaxLength(50);

        e.Property(x => x.CreatedBy).HasMaxLength(450);
        e.Property(x => x.ModifiedBy).HasMaxLength(450);

        e.HasIndex(x => x.Code).IsUnique();
    }
}
