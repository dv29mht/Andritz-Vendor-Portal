using AndritzVendorPortal.Application.Features.VendorRequests.Common;
using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Infrastructure.BackgroundServices;
using AndritzVendorPortal.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// Runs against a real SQL Server. Skipped unless <c>SOT_TEST_SQL</c> holds a connection string:
///
///   docker run -d --name sot-sqltest -e ACCEPT_EULA=1 -e "MSSQL_SA_PASSWORD=Str0ng!TestPassw0rd" \
///     -p 14333:1433 mcr.microsoft.com/azure-sql-edge:latest
///   SOT_TEST_SQL="Server=localhost,14333;Database=SOT_Test;User Id=sa;Password=Str0ng!TestPassw0rd;TrustServerCertificate=True" \
///     dotnet test
///
/// <para>These cover the two things SQLite structurally cannot: the <c>rowversion</c> concurrency
/// token (SQLite has no server-generated rowversion, so the guard is inert there), and whether the
/// migration itself actually applies — filtered index, rowversion column and all.</para>
/// </summary>
public class SqlServerConcurrencyTests
{
    private sealed class RequiresSqlServerFactAttribute : FactAttribute
    {
        public RequiresSqlServerFactAttribute()
        {
            if (string.IsNullOrWhiteSpace(ConnectionString))
                Skip = "Set SOT_TEST_SQL to a SQL Server connection string to run this.";
        }
    }

    private static string? ConnectionString => Environment.GetEnvironmentVariable("SOT_TEST_SQL");

    /// <summary>A fresh database per test, built by running the real migrations.</summary>
    private static async Task<ApplicationDbContext> NewDatabaseAsync(string dbName)
    {
        var connection = ConnectionString!.Replace("Database=SOT_Test", $"Database={dbName}");
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;

        var db = new ApplicationDbContext(options);
        await db.Database.EnsureDeletedAsync();
        // Migrate(), not EnsureCreated() — this is the deployment path, so the test proves the
        // migration applies to SQL Server rather than proving the model can be created from scratch.
        await db.Database.MigrateAsync();
        return db;
    }

    private static ApplicationDbContext Attach(string dbName)
    {
        var connection = ConnectionString!.Replace("Database=SOT_Test", $"Database={dbName}");
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        return new ApplicationDbContext(options);
    }

    private static VendorRequest NewDraft(params string[] approvers)
    {
        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.Draft,
            CreatedByUserId = "buyer-1",
        };
        var order = 1;
        foreach (var a in approvers)
            request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = a, ApproverName = $"User {a}", StepOrder = order++ });
        request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = "final", ApproverName = "Final", StepOrder = order, IsFinalApproval = true });
        return request;
    }

    [RequiresSqlServerFact]
    public async Task The_migration_applies_cleanly_and_creates_the_outbox_and_rowversion()
    {
        using var db = await NewDatabaseAsync("SOT_Migrate");

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());

        // The rowversion column exists and SQL Server populates it on insert with no help from us.
        var request = NewDraft("a");
        db.VendorRequests.Add(request);
        await db.SaveChangesAsync();
        Assert.NotNull(request.RowVersion);
        Assert.NotEmpty(request.RowVersion!);

        // And the outbox table + its filtered index are real.
        db.OutboxEmails.Add(new OutboxEmail
        {
            ToEmail = "a@andritz.com",
            Subject = "Approval required",
            BodyHtml = "<p>hi</p>",
            AttachVendorRequestId = request.Id,
            CreatedAt = DateTime.UtcNow,
            NextAttemptAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        Assert.Single(await db.OutboxEmails.Where(m => m.SentAt == null && !m.IsAbandoned).ToListAsync());
    }

    [RequiresSqlServerFact]
    public async Task RowVersion_makes_the_second_of_two_concurrent_save_drafts_lose_cleanly()
    {
        // The exact production shape: two SaveDraftCommands on the same request, both rewriting the
        // approval chain. On SQL Server the rowversion is what stops the second one — this is the
        // guard SQLite cannot exercise.
        using var seed = await NewDatabaseAsync("SOT_Race");
        var request = NewDraft("a", "b");
        seed.VendorRequests.Add(request);
        await seed.SaveChangesAsync();
        var id = request.Id;

        using var ctx1 = Attach("SOT_Race");
        using var ctx2 = Attach("SOT_Race");
        var r1 = await ctx1.VendorRequests.Include(r => r.ApprovalSteps).SingleAsync(r => r.Id == id);
        var r2 = await ctx2.VendorRequests.Include(r => r.ApprovalSteps).SingleAsync(r => r.Id == id);

        // Writer 1 commits.
        r1.UpdatedAt = DateTime.UtcNow;
        await ApprovalChainBuilder.RebuildIntermediateAsync(r1, ctx1, ["x", "y"], new FakeIdentityService("x", "y"), default);
        await ctx1.SaveChangesAsync();

        // Writer 2 read the same rowversion and must now lose — as a 409, never a duplicate-key 500.
        r2.UpdatedAt = DateTime.UtcNow;
        var ex = await Record.ExceptionAsync(async () =>
        {
            await ApprovalChainBuilder.RebuildIntermediateAsync(r2, ctx2, ["p", "q"], new FakeIdentityService("p", "q"), default);
            await ctx2.SaveChangesAsync();
        });

        Assert.IsType<DbUpdateConcurrencyException>(ex);
        Assert.DoesNotContain("duplicate key", ex!.ToString(), StringComparison.OrdinalIgnoreCase);

        using var verify = Attach("SOT_Race");
        var chain = await verify.ApprovalSteps.IgnoreQueryFilters()
            .Where(s => s.VendorRequestId == id).OrderBy(s => s.StepOrder).ToListAsync();

        // Writer 1's chain stands, intact and contiguous.
        Assert.Equal(["x", "y", "final"], chain.Select(s => s.ApproverUserId));
        Assert.Equal([1, 2, 3], chain.Select(s => s.StepOrder));
    }

    [RequiresSqlServerFact]
    public async Task Two_concurrent_approvals_of_the_same_step_let_exactly_one_through()
    {
        using var seed = await NewDatabaseAsync("SOT_Approve");
        var request = NewDraft("a");
        request.Status = VendorRequestStatus.PendingApproval;
        seed.VendorRequests.Add(request);
        await seed.SaveChangesAsync();
        var id = request.Id;

        using var ctx1 = Attach("SOT_Approve");
        using var ctx2 = Attach("SOT_Approve");
        var s1 = await ctx1.ApprovalSteps.IgnoreQueryFilters().SingleAsync(s => s.VendorRequestId == id && s.ApproverUserId == "a");
        var s2 = await ctx2.ApprovalSteps.IgnoreQueryFilters().SingleAsync(s => s.VendorRequestId == id && s.ApproverUserId == "a");

        s1.Decision = ApprovalDecision.Approved;
        s1.DecidedAt = DateTime.UtcNow;
        await ctx1.SaveChangesAsync();

        s2.Decision = ApprovalDecision.Approved;
        s2.DecidedAt = DateTime.UtcNow;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => ctx2.SaveChangesAsync());

        using var verify = Attach("SOT_Approve");
        Assert.Single(await verify.ApprovalSteps.IgnoreQueryFilters()
            .Where(s => s.VendorRequestId == id && s.Decision == ApprovalDecision.Approved).ToListAsync());
    }

    /// <summary>
    /// The A2 outbox claim, on the engine it actually runs against. Two overlapping IIS workers both
    /// select the same due row and both call TryClaimAsync — a conditional
    /// <c>UPDATE … WHERE NextAttemptAt &lt;= @due</c>. The whole guarantee rests on SQL Server
    /// serialising those UPDATEs on the row lock so exactly one sees a rowcount of 1; SQLite's
    /// database-level write lock makes the SQLite test pass for the wrong reason, so this is the one
    /// that proves it. Ten claimants, not two, to give any lost-update window room to show itself.
    /// </summary>
    [RequiresSqlServerFact]
    public async Task Concurrent_outbox_claims_on_one_due_row_let_exactly_one_win()
    {
        using var seed = await NewDatabaseAsync("SOT_Claim");
        var now = new DateTime(2026, 7, 14, 9, 0, 0, DateTimeKind.Utc);
        seed.OutboxEmails.Add(new OutboxEmail
        {
            ToEmail = "a@andritz.com",
            Subject = "Approval required",
            BodyHtml = "<p>hi</p>",
            CreatedAt = now,
            NextAttemptAt = now,   // due
        });
        await seed.SaveChangesAsync();
        var id = seed.OutboxEmails.Single().Id;

        var leaseUntil = now.AddSeconds(120);

        // Every claimant on its own context/connection, released together, so they genuinely contend.
        var contexts = Enumerable.Range(0, 10).Select(_ => Attach("SOT_Claim")).ToList();
        try
        {
            var gate = new TaskCompletionSource();
            var claims = contexts.Select(ctx => Task.Run(async () =>
            {
                await gate.Task;
                return await OutboxEmailDispatcher.TryClaimAsync(
                    ctx, new OutboxEmail { Id = id }, now, leaseUntil, default);
            })).ToList();

            gate.SetResult();
            var results = await Task.WhenAll(claims);

            Assert.Equal(1, results.Count(won => won));   // exactly one winner

            using var verify = Attach("SOT_Claim");
            var row = await verify.OutboxEmails.SingleAsync(m => m.Id == id);
            Assert.Equal(1, row.AttemptCount);            // claimed once — no lost update
            Assert.Equal(leaseUntil, row.NextAttemptAt);  // held by the lease, off the due set
            Assert.Null(row.SentAt);
        }
        finally
        {
            foreach (var ctx in contexts) ctx.Dispose();
        }
    }
}
