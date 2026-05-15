using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.EmailTemplates.Commands;
using AndritzVendorPortal.Application.Features.EmailTemplates.Queries;
using AndritzVendorPortal.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AndritzVendorPortal.API.Controllers;

public record UpdateEmailTemplateRequestModel(string Subject, string BodyText);
public record PreviewEmailTemplateRequestModel(Dictionary<string, string?>? Values);

[ApiController]
[Route("api/email-templates")]
[Authorize(Roles = Roles.Admin)]
public class EmailTemplatesController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Result<List<EmailTemplateListItemDto>>>> GetAll() =>
        Ok(Result<List<EmailTemplateListItemDto>>.Ok(await mediator.Send(new GetAllEmailTemplatesQuery())));

    [HttpGet("{code}")]
    public async Task<ActionResult<Result<EmailTemplateDetailDto>>> Get(string code) =>
        Ok(Result<EmailTemplateDetailDto>.Ok(await mediator.Send(new GetEmailTemplateByCodeQuery(code))));

    [HttpPut("{code}")]
    public async Task<ActionResult<Result<EmailTemplateDetailDto>>> Update(
        string code, [FromBody] UpdateEmailTemplateRequestModel m)
    {
        var dto = await mediator.Send(new UpdateEmailTemplateCommand(code, m.Subject, m.BodyText));
        return Ok(Result<EmailTemplateDetailDto>.Ok(dto, "Template updated."));
    }

    [HttpPost("{code}/reset")]
    public async Task<ActionResult<Result<EmailTemplateDetailDto>>> Reset(string code)
    {
        var dto = await mediator.Send(new ResetEmailTemplateCommand(code));
        return Ok(Result<EmailTemplateDetailDto>.Ok(dto, "Template reset to default."));
    }

    [HttpPost("{code}/preview")]
    public async Task<ActionResult<Result<PreviewEmailTemplateResult>>> Preview(
        string code, [FromBody] PreviewEmailTemplateRequestModel? m)
    {
        var result = await mediator.Send(new PreviewEmailTemplateQuery(code, m?.Values));
        return Ok(Result<PreviewEmailTemplateResult>.Ok(result));
    }
}
