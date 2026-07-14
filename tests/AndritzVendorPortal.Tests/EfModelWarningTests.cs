using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// The two EF warnings the app logged on every single boot. TestDb promotes both to exceptions
/// (see its ConfigureWarnings), so these tests fail loudly if either regresses.
/// </summary>
public class EfModelWarningTests
{
    [Fact]
    public void The_model_validates_without_the_required_navigation_query_filter_warning()
    {
        // VendorRequest has a global !IsArchived filter and is the required principal of both
        // ApprovalStep and VendorRevision. Without matching filters on the dependents, EF warns
        // that rows can be silently dropped. Touching Model runs model validation.
        using var h = new TestDb();

        var model = h.Db.Model;

        Assert.NotNull(model.FindEntityType(typeof(ApprovalStep))?.GetQueryFilter());
        Assert.NotNull(model.FindEntityType(typeof(VendorRevision))?.GetQueryFilter());
    }

    [Fact]
    public async Task The_detail_query_splits_instead_of_cross_joining_its_two_collections()
    {
        // GetByIdWithDetailsAsync Includes both ApprovalSteps and RevisionHistory. In a single
        // query that is a cartesian product — and every row of it re-sends the request's
        // nvarchar(max) document blobs. AsSplitQuery is what stops that; without it this call
        // raises MultipleCollectionIncludeWarning, which TestDb throws on.
        using var h = new TestDb();

        var request = new VendorRequest
        {
            VendorName = "Acme Metals",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
        };
        request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = "a", StepOrder = 1 });
        request.ApprovalSteps.Add(new ApprovalStep { ApproverUserId = "f", StepOrder = 2, IsFinalApproval = true });
        request.RevisionHistory.Add(new VendorRevision { RevisionNo = 1, ChangedByUserId = "buyer-1" });
        request.RevisionHistory.Add(new VendorRevision { RevisionNo = 2, ChangedByUserId = "buyer-1" });
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();

        var repo = new VendorRequestRepository(h.Db);
        var loaded = await repo.GetByIdWithDetailsAsync(request.Id);

        Assert.NotNull(loaded);
        // Each collection is materialised once — not steps × revisions times.
        Assert.Equal(2, loaded.ApprovalSteps.Count);
        Assert.Equal(2, loaded.RevisionHistory.Count);
    }
}
