using AndritzVendorPortal.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

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
    DbSet<EmailTemplate> EmailTemplates { get; }
    DbSet<LoginSecurity> LoginSecurities { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<OutboxEmail> OutboxEmails { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Opens an explicit transaction. Needed only by the handlers that rebuild the approval
    /// chain: their outbox emails embed one-click action tokens keyed by ApprovalStep.Id, which
    /// EF only assigns once the rows are inserted. They save the state change, build the mail
    /// against the now-real IDs, save the outbox rows, and commit — so the two writes still land
    /// atomically. Handlers that don't need post-insert IDs stage the outbox rows before a single
    /// SaveChangesAsync and need no transaction of their own.
    /// </summary>
    Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
}
