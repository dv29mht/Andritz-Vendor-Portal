using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.EmailTemplates.Queries;

public record GetEmailTemplateByCodeQuery(string Code) : IRequest<EmailTemplateDetailDto>;

public class GetEmailTemplateByCodeQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetEmailTemplateByCodeQuery, EmailTemplateDetailDto>
{
    public async Task<EmailTemplateDetailDto> Handle(GetEmailTemplateByCodeQuery request, CancellationToken ct)
    {
        var t = await db.EmailTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == request.Code, ct)
            ?? throw new NotFoundException("EmailTemplate", request.Code);

        return new EmailTemplateDetailDto(
            t.Id, t.Code, t.Name, t.Audience, t.Subject, t.BodyText,
            t.DefaultSubject, t.DefaultBodyText, t.Placeholders, t.UpdatedAt,
            t.Subject != t.DefaultSubject || t.BodyText != t.DefaultBodyText);
    }
}
