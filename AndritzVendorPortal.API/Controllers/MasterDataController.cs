using AndritzVendorPortal.API.Data;
using AndritzVendorPortal.API.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/master-data")]
[Authorize]
public class MasterDataController(ApplicationDbContext db) : ControllerBase
{
    // ── GET /api/master-data/material-groups ─────────────────────────────────
    // Returns all distinct MaterialGroup values from submitted vendor requests.
    // Shared across all buyers so everyone sees all material groups entered.
    [HttpGet("material-groups")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<IActionResult> GetMaterialGroups()
    {
        var groups = await db.VendorRequests
            .AsNoTracking()
            .Where(r => r.MaterialGroup != null && r.MaterialGroup != string.Empty)
            .Select(r => r.MaterialGroup)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();

        return Ok(groups);
    }

    // ── GET /api/master-data/proposed-by ─────────────────────────────────────
    // Returns all distinct ProposedBy values from submitted vendor requests.
    [HttpGet("proposed-by")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<IActionResult> GetProposedByNames()
    {
        var names = await db.VendorRequests
            .AsNoTracking()
            .Where(r => r.ProposedBy != null && r.ProposedBy != string.Empty)
            .Select(r => r.ProposedBy)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync();

        return Ok(names);
    }
}
