using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Application.Features.MasterData.Queries;
using AndritzVendorPortal.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/master-data")]
[Authorize]
public class MasterDataController(IMediator mediator) : ControllerBase
{
    [HttpGet("material-groups")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<ActionResult<Result<List<string>>>> GetMaterialGroups() =>
        Ok(Result<List<string>>.Ok(await mediator.Send(new GetMaterialGroupsQuery())));

    [HttpGet("proposed-by")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<ActionResult<Result<List<string>>>> GetProposedByNames() =>
        Ok(Result<List<string>>.Ok(await mediator.Send(new GetProposedByNamesQuery())));
}
