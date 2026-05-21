using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AndritzVendorPortal.Infrastructure.Persistence.Configurations;

public class LoginSecurityConfiguration : IEntityTypeConfiguration<LoginSecurity>
{
    public void Configure(EntityTypeBuilder<LoginSecurity> e)
    {
        e.HasKey(x => x.Id);

        e.Property(x => x.UserId).IsRequired().HasMaxLength(450);
        e.Property(x => x.Role).IsRequired().HasMaxLength(100);
        e.Property(x => x.TokensValidSince).IsRequired();

        e.HasIndex(x => new { x.UserId, x.Role }).IsUnique();
    }
}
