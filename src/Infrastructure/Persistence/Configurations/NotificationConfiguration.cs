using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AndritzVendorPortal.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(n => n.Id);

        builder.Property(n => n.RecipientUserId).IsRequired().HasMaxLength(450);
        builder.Property(n => n.Type).IsRequired().HasMaxLength(64);
        builder.Property(n => n.Title).IsRequired().HasMaxLength(256);
        builder.Property(n => n.Body).IsRequired().HasMaxLength(1024);

        // The hot query is "this user's notifications, newest first".
        builder.HasIndex(n => new { n.RecipientUserId, n.CreatedAt });
    }
}
