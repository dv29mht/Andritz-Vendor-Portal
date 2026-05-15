using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.EmailTemplates.Queries;

public record GetAllEmailTemplatesQuery() : IRequest<List<EmailTemplateListItemDto>>;

public class GetAllEmailTemplatesQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetAllEmailTemplatesQuery, List<EmailTemplateListItemDto>>
{
    public async Task<List<EmailTemplateListItemDto>> Handle(GetAllEmailTemplatesQuery request, CancellationToken ct)
    {
        var rows = await db.EmailTemplates
            .AsNoTracking()
            .OrderBy(t => t.Audience)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);

        return rows.Select(t => new EmailTemplateListItemDto(
            t.Id, t.Code, t.Name, t.Audience, t.Subject, t.Placeholders, t.UpdatedAt,
            t.Subject != t.DefaultSubject || t.BodyText != t.DefaultBodyText)).ToList();
    }
}
