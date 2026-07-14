using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// A real relational database (SQLite, in memory) built from the production EF model — indexes and
/// all. The bug under test is a unique-index collision on
/// IX_ApprovalSteps_VendorRequestId_StepOrder, which the EF in-memory provider does not enforce at
/// all and would therefore "pass" even against the broken code.
///
/// <para>Uses SQLite's shared cache so <see cref="NewContext"/> can hand out independent contexts
/// over separate connections — that is what lets a test stage two racing writers, which is the only
/// way the original delete-then-reinsert ever failed (it is perfectly safe single-threaded: EF
/// orders the DELETEs ahead of the INSERTs within one SaveChanges).</para>
/// </summary>
public sealed class TestDb : IDisposable
{
    private readonly string _connectionString;
    private readonly SqliteConnection _keepAlive;
    private readonly List<ApplicationDbContext> _contexts = [];

    /// <summary>The default context. Tests that don't need a race use only this one.</summary>
    public ApplicationDbContext Db { get; }

    public TestDb()
    {
        // A shared-cache in-memory database lives only as long as a connection to it is open, hence
        // the keep-alive.
        _connectionString = $"DataSource=file:testdb-{Guid.NewGuid():N}?mode=memory&cache=shared";
        _keepAlive = new SqliteConnection(_connectionString);
        _keepAlive.Open();

        Db = NewContext();
        Db.Database.EnsureCreated();
    }

    /// <summary>An independent context with its own connection and its own change tracker.</summary>
    public ApplicationDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connectionString)
            // The two warnings this app used to log on every boot are promoted to exceptions, so
            // the whole suite fails the moment either comes back:
            //   - a required navigation whose principal carries a query filter the dependent does
            //     not (rows can be silently dropped), and
            //   - multiple collection Includes in one query with no QuerySplittingBehavior
            //     (a cartesian explosion — and this entity has nvarchar(max) document blobs).
            .ConfigureWarnings(w => w.Throw(
                CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning,
                RelationalEventId.MultipleCollectionIncludeWarning))
            .Options;

        var context = new SqliteApplicationDbContext(options);
        _contexts.Add(context);
        return context;
    }

    public void Dispose()
    {
        foreach (var context in _contexts) context.Dispose();
        _keepAlive.Dispose();
    }

    /// <summary>
    /// The production model pins a few document columns to the SQL Server type nvarchar(max), which
    /// SQLite cannot parse. Rewrite just those to TEXT for the test schema; everything the tests
    /// assert on — keys, unique indexes, relationships, concurrency tokens — comes through untouched.
    /// </summary>
    private sealed class SqliteApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : ApplicationDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            foreach (var property in builder.Model.GetEntityTypes().SelectMany(t => t.GetProperties()))
            {
                if (property.GetColumnType()?.Contains("nvarchar", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetColumnType("TEXT");
            }
        }
    }
}

/// <summary>Resolves approver IDs to names without touching ASP.NET Identity.</summary>
public sealed class FakeIdentityService(params string[] userIds) : IIdentityService
{
    private readonly HashSet<string> _users = [.. userIds];

    public Task<UserInfoDto?> FindByIdAsync(string userId) =>
        Task.FromResult(_users.Contains(userId)
            ? new UserInfoDto(userId, $"{userId}@andritz.com", $"User {userId}", "Approver", false)
            : null);

    public Task<UserInfoDto?> FindByEmailAsync(string email) => Task.FromResult<UserInfoDto?>(null);
    public Task<bool> CheckPasswordAsync(string email, string password) => Task.FromResult(false);
    public Task<bool> IsLockedOutAsync(string email) => Task.FromResult(false);
    public Task<IReadOnlyList<string>> GetRolesAsync(string userId) => Task.FromResult<IReadOnlyList<string>>(["Approver"]);
    public Task<IReadOnlyList<UserInfoDto>> GetAllUsersAsync(bool includeArchived = false) => throw new NotSupportedException();
    public Task<IReadOnlyList<UserWithRolesDto>> GetUsersWithRolesAsync(bool includeArchived = false) => throw new NotSupportedException();
    public Task<IReadOnlyList<UserInfoDto>> GetUsersInRoleAsync(string role) => throw new NotSupportedException();
    public Task<(bool, string, IReadOnlyList<string>)> CreateUserAsync(string email, string password, string fullName, string? designation, string role) => throw new NotSupportedException();
    public Task<(bool, IReadOnlyList<string>)> UpdateUserAsync(string userId, string fullName, string email, string? designation, string role, string? newPassword) => throw new NotSupportedException();
    public Task<(bool, IReadOnlyList<string>)> UpdateProfileAsync(string userId, string fullName, string? currentPassword, string? newPassword) => throw new NotSupportedException();
    public Task<(bool, IReadOnlyList<string>)> ArchiveUserAsync(string userId) => throw new NotSupportedException();
    public Task<(bool, IReadOnlyList<string>)> RestoreUserAsync(string userId) => throw new NotSupportedException();
    public Task<(bool, IReadOnlyList<string>)> PurgeUserAsync(string userId) => throw new NotSupportedException();
    public Task<string> GeneratePasswordResetTokenAsync(string email) => throw new NotSupportedException();
    public Task<(bool, IReadOnlyList<string>)> ResetPasswordAsync(string email, string token, string newPassword) => throw new NotSupportedException();
    public Task PropagateUserNameChangeAsync(string userId, string newFullName, CancellationToken ct = default) => Task.CompletedTask;
}
