using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.VendorRequests.Commands;
using AndritzVendorPortal.Application.Features.VendorRequests.Queries;
using AndritzVendorPortal.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AndritzVendorPortal.API.Controllers;

public record CreateDraftModel(
    string? VendorName, string? ContactPerson, string? Telephone, string? GstNumber, string? PanCard,
    string? AddressDetails, string? City, string? Locality, string? MaterialGroup, string? PostalCode,
    string? State, string? Country, string? Currency, string? PaymentTerms, string? Incoterms,
    string? Reason, string? YearlyPvo, bool? IsOneTimeVendor, string? ProposedBy,
    List<string>? ApproverUserIds);

public record CreateVendorRequestModel(
    string VendorName, string ContactPerson, string? Telephone, string GstNumber, string PanCard,
    string AddressDetails, string City, string Locality, string? MaterialGroup, string? PostalCode,
    string? State, string? Country, string? Currency, string? PaymentTerms, string? Incoterms,
    string? Reason, string? YearlyPvo, bool? IsOneTimeVendor, string? ProposedBy,
    List<string>? ApproverUserIds);

public record ResubmitVendorRequestModel(
    string VendorName, string ContactPerson, string? Telephone, string GstNumber, string PanCard,
    string AddressDetails, string City, string Locality, string? MaterialGroup, string? PostalCode,
    string? State, string? Country, string? Currency, string? PaymentTerms, string? Incoterms,
    string? Reason, string? YearlyPvo, bool? IsOneTimeVendor, string? ProposedBy,
    List<string>? ApproverUserIds);

public record AdminEditModel(
    string VendorName, string ContactPerson, string? Telephone, string GstNumber, string PanCard,
    string AddressDetails, string City, string Locality, string? MaterialGroup, string? PostalCode,
    string? State, string? Country, string? Currency, string? PaymentTerms, string? Incoterms,
    string? Reason, string? YearlyPvo, bool? IsOneTimeVendor, string? ProposedBy);

public record ApproveModel(string? Comment);
public record RejectModel(string Comment);
public record CompleteModel(string VendorCode);
public record ClassifyModel(bool IsOneTimeVendor);

[ApiController]
[Route("api/vendor-requests")]
[Authorize]
public class VendorRequestsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<ActionResult<Result<List<VendorRequestDetailDto>>>> GetAll() =>
        Ok(Result<List<VendorRequestDetailDto>>.Ok(await mediator.Send(new GetVendorRequestsQuery())));

    [HttpGet("history")]
    [Authorize(Roles = $"{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<ActionResult<Result<List<VendorRequestDetailDto>>>> GetHistory() =>
        Ok(Result<List<VendorRequestDetailDto>>.Ok(await mediator.Send(new GetVendorRequestHistoryQuery())));

    [HttpGet("{id:int}")]
    [Authorize(Roles = $"{Roles.Admin},{Roles.Buyer},{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> GetById(int id) =>
        Ok(Result<VendorRequestDetailDto>.Ok(await mediator.Send(new GetVendorRequestByIdQuery(id))));

    [HttpPost("draft")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> CreateDraft([FromBody] CreateDraftModel m)
    {
        var dto = await mediator.Send(new CreateDraftCommand(
            m.VendorName, m.ContactPerson, m.Telephone, m.GstNumber, m.PanCard, m.AddressDetails,
            m.City, m.Locality, m.MaterialGroup, m.PostalCode, m.State, m.Country, m.Currency,
            m.PaymentTerms, m.Incoterms, m.Reason, m.YearlyPvo, m.IsOneTimeVendor, m.ProposedBy,
            m.ApproverUserIds));
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, Result<VendorRequestDetailDto>.Ok(dto));
    }

    [HttpPost]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Create([FromBody] CreateVendorRequestModel m)
    {
        var dto = await mediator.Send(new CreateVendorRequestCommand(
            m.VendorName, m.ContactPerson, m.Telephone, m.GstNumber, m.PanCard, m.AddressDetails,
            m.City, m.Locality, m.MaterialGroup, m.PostalCode, m.State, m.Country, m.Currency,
            m.PaymentTerms, m.Incoterms, m.Reason, m.YearlyPvo, m.IsOneTimeVendor, m.ProposedBy,
            m.ApproverUserIds));
        return CreatedAtAction(nameof(GetById), new { id = dto.Id }, Result<VendorRequestDetailDto>.Ok(dto));
    }

    [HttpPut("{id:int}/save-draft")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> SaveDraft(int id, [FromBody] CreateDraftModel m)
    {
        var dto = await mediator.Send(new SaveDraftCommand(
            id, m.VendorName, m.ContactPerson, m.Telephone, m.GstNumber, m.PanCard, m.AddressDetails,
            m.City, m.Locality, m.MaterialGroup, m.PostalCode, m.State, m.Country, m.Currency,
            m.PaymentTerms, m.Incoterms, m.Reason, m.YearlyPvo, m.IsOneTimeVendor, m.ProposedBy,
            m.ApproverUserIds));
        return Ok(Result<VendorRequestDetailDto>.Ok(dto));
    }

    [HttpPost("{id:int}/submit")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Submit(int id) =>
        Ok(Result<VendorRequestDetailDto>.Ok(await mediator.Send(new SubmitVendorRequestCommand(id))));

    [HttpPost("{id:int}/resubmit")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Resubmit(int id, [FromBody] ResubmitVendorRequestModel m)
    {
        var dto = await mediator.Send(new ResubmitVendorRequestCommand(
            id, m.VendorName, m.ContactPerson, m.Telephone, m.GstNumber, m.PanCard, m.AddressDetails,
            m.City, m.Locality, m.MaterialGroup, m.PostalCode, m.State, m.Country, m.Currency,
            m.PaymentTerms, m.Incoterms, m.Reason, m.YearlyPvo, m.IsOneTimeVendor, m.ProposedBy,
            m.ApproverUserIds));
        return Ok(Result<VendorRequestDetailDto>.Ok(dto));
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = Roles.Approver)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Approve(int id, [FromBody] ApproveModel m) =>
        Ok(Result<VendorRequestDetailDto>.Ok(await mediator.Send(new ApproveVendorRequestCommand(id, m.Comment))));

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = $"{Roles.Approver},{Roles.FinalApprover}")]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Reject(int id, [FromBody] RejectModel m) =>
        Ok(Result<VendorRequestDetailDto>.Ok(await mediator.Send(new RejectVendorRequestCommand(id, m.Comment))));

    [HttpPost("{id:int}/complete")]
    [Authorize(Policy = Policies.FinalApproverOnly)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Complete(int id, [FromBody] CompleteModel m) =>
        Ok(Result<VendorRequestDetailDto>.Ok(await mediator.Send(new CompleteVendorRequestCommand(id, m.VendorCode))));

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> AdminEdit(int id, [FromBody] AdminEditModel m)
    {
        var dto = await mediator.Send(new AdminEditVendorRequestCommand(
            id, m.VendorName, m.ContactPerson, m.Telephone, m.GstNumber, m.PanCard, m.AddressDetails,
            m.City, m.Locality, m.MaterialGroup, m.PostalCode, m.State, m.Country, m.Currency,
            m.PaymentTerms, m.Incoterms, m.Reason, m.YearlyPvo, m.IsOneTimeVendor, m.ProposedBy));
        return Ok(Result<VendorRequestDetailDto>.Ok(dto));
    }

    [HttpPut("{id:int}/buyer-update")]
    [Authorize(Roles = Roles.Buyer)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> BuyerUpdateCompleted(int id, [FromBody] ResubmitVendorRequestModel m)
    {
        var dto = await mediator.Send(new BuyerUpdateCompletedCommand(
            id, m.VendorName, m.ContactPerson, m.Telephone, m.GstNumber, m.PanCard, m.AddressDetails,
            m.City, m.Locality, m.MaterialGroup, m.PostalCode, m.State, m.Country, m.Currency,
            m.PaymentTerms, m.Incoterms, m.Reason, m.YearlyPvo, m.IsOneTimeVendor, m.ProposedBy,
            m.ApproverUserIds));
        return Ok(Result<VendorRequestDetailDto>.Ok(dto));
    }

    [HttpPatch("{id:int}/classify")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result<VendorRequestDetailDto>>> Classify(int id, [FromBody] ClassifyModel m) =>
        Ok(Result<VendorRequestDetailDto>.Ok(await mediator.Send(new ClassifyVendorRequestCommand(id, m.IsOneTimeVendor))));

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result>> Archive(int id)
    {
        await mediator.Send(new ArchiveVendorRequestCommand(id));
        return Ok(Result.Ok("Vendor request archived."));
    }

    [HttpPost("{id:int}/restore")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<Result>> Restore(int id)
    {
        await mediator.Send(new RestoreVendorRequestCommand(id));
        return Ok(Result.Ok("Vendor request restored."));
    }
}
