using AndritzVendorPortal.Domain.Entities;
using AndritzVendorPortal.Domain.Enums;
using AndritzVendorPortal.Infrastructure.Persistence.Repositories;
using Xunit;

namespace AndritzVendorPortal.Tests;

/// <summary>
/// The list/grid path projects each VendorRequest through a trimmed POCO (see
/// <c>VendorRequestRepository.ListRow</c>) so the four nvarchar(max) document blobs never leave SQL.
/// Any scalar the form collects but that projection forgets comes back as an empty string, and every
/// grid and every detail modal fed from the list row shows a blank where the buyer typed a value —
/// which is exactly how the contact Email went missing from the approver's view while the by-id
/// detail endpoint (a different, full-entity path) still had it.
/// </summary>
public class VendorRequestListProjectionTests
{
    private static async Task<int> SeedAsync(TestDb h, string email)
    {
        var request = new VendorRequest
        {
            VendorName = "ABC Corp",
            Status = VendorRequestStatus.PendingApproval,
            CreatedByUserId = "buyer-1",
            ContactPerson = "Devansh Mehta",
            Telephone = "9319744399",
            Email = email,
        };
        h.Db.VendorRequests.Add(request);
        await h.Db.SaveChangesAsync();
        return request.Id;
    }

    [Fact]
    public async Task The_list_projection_carries_the_contact_email()
    {
        using var h = new TestDb();
        var id = await SeedAsync(h, "mdevansh@gmail.com");

        var repo = new VendorRequestRepository(h.NewContext());
        var list = await repo.GetAllWithDetailsAsync();

        var row = Assert.Single(list, r => r.Id == id);
        // The three contact fields travel together; Email must survive the projection like the
        // other two, not default back to empty.
        Assert.Equal("Devansh Mehta", row.ContactPerson);
        Assert.Equal("9319744399", row.Telephone);
        Assert.Equal("mdevansh@gmail.com", row.Email);
    }

    [Fact]
    public async Task The_buyer_and_approver_list_paths_both_carry_the_email()
    {
        using var h = new TestDb();
        var id = await SeedAsync(h, "mdevansh@gmail.com");
        h.Db.ApprovalSteps.Add(new ApprovalStep
        {
            VendorRequestId = id, ApproverUserId = "appr-1", ApproverName = "User appr-1", StepOrder = 1,
        });
        await h.Db.SaveChangesAsync();

        var repo = new VendorRequestRepository(h.NewContext());

        var forBuyer = Assert.Single(await repo.GetForBuyerAsync("buyer-1"), r => r.Id == id);
        var forApprover = Assert.Single(await repo.GetForApproverAsync("appr-1"), r => r.Id == id);

        Assert.Equal("mdevansh@gmail.com", forBuyer.Email);
        Assert.Equal("mdevansh@gmail.com", forApprover.Email);
    }
}
