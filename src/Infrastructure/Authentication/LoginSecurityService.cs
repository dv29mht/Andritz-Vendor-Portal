using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Infrastructure.Authentication;

public class LoginSecurityService(ApplicationDbContext db, IDateTimeProvider clock) : ILoginSecurityService
{
    public async Task<DateTime?> GetTokensValidSinceAsync(string userId, string role, CancellationToken ct = default)
    {
        var row = await db.LoginSecurities
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Role == role, ct);
        return row?.TokensValidSince;
    }

    public async Task RevokeAllAsync(string userId, IEnumerable<string> roles, CancellationToken ct = default)
    {
        foreach (var role in roles)
            await UpsertAsync(userId, role, ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task RevokeAsync(string userId, string role, CancellationToken ct = default)
    {
        await UpsertAsync(userId, role, ct);
        await db.SaveChangesAsync(ct);
    }

    private async Task UpsertAsync(string userId, string role, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var row = await db.LoginSecurities
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Role == role, ct);
        if (row is null)
        {
            db.LoginSecurities.Add(new LoginSecurity
            {
                UserId = userId,
                Role = role,
                TokensValidSince = now
            });
        }
        else
        {
            row.TokensValidSince = now;
        }
    }
}
