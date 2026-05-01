using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.Users.Commands;
using AndritzVendorPortal.Application.Features.Users.Queries;
using AndritzVendorPortal.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AndritzVendorPortal.API.Controllers;

public record CreateUserRequestModel(string FullName, string Email, string Password, string Role, string? Designation);
public record UpdateUserRequestModel(string FullName, string Email, string? Designation, string Role, string? NewPassword);
public record UpdateProfileRequestModel(string FullName, string? CurrentPassword, string? NewPassword);

[ApiController]
[Route("api/users")]
[Authorize]
public class UsersController(IMediator mediator) : ControllerBase
{
    [HttpGet("approvers")]
    [Authorize(Roles = $"{Roles.Buyer},{Roles.Admin}")]
    public async Task<ActionResult<Result<List<ApproverSummaryDto>>>> GetApprovers() =>
        Ok(Result<List<ApproverSummaryDto>>.Ok(await mediator.Send(new GetApproversQuery())));

    [HttpGet]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<List<UserDto>>>> GetAll() =>
        Ok(Result<List<UserDto>>.Ok(await mediator.Send(new GetAllUsersQuery())));

    [HttpGet("archived")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<List<UserDto>>>> GetArchived() =>
        Ok(Result<List<UserDto>>.Ok(await mediator.Send(new GetAllUsersQuery(IncludeArchived: true))));

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<UserDto>>> Create([FromBody] CreateUserRequestModel m)
    {
        var dto = await mediator.Send(new CreateUserCommand(m.FullName, m.Email, m.Password, m.Role, m.Designation));
        return Ok(Result<UserDto>.Ok(dto));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<UserDto>>> Update(string id, [FromBody] UpdateUserRequestModel m)
    {
        var dto = await mediator.Send(new UpdateUserCommand(id, m.FullName, m.Email, m.Designation, m.Role, m.NewPassword));
        return Ok(Result<UserDto>.Ok(dto));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result>> Archive(string id)
    {
        await mediator.Send(new ArchiveUserCommand(id));
        return Ok(Result.Ok("User archived."));
    }

    [HttpPut("{id}/restore")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<UserDto>>> Restore(string id) =>
        Ok(Result<UserDto>.Ok(await mediator.Send(new RestoreUserCommand(id))));

    [HttpDelete("{id}/purge")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result>> Purge(string id)
    {
        await mediator.Send(new PurgeUserCommand(id));
        return Ok(Result.Ok("User permanently deleted."));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<Result<object>>> UpdateProfile([FromBody] UpdateProfileRequestModel m)
    {
        var dto = await mediator.Send(new UpdateProfileCommand(m.FullName, m.CurrentPassword, m.NewPassword));
        return Ok(Result<object>.Ok(dto));
    }
}
