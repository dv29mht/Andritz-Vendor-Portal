using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.EmailTemplates.Commands;

public record ResetEmailTemplateCommand(string Code) : IRequest<EmailTemplateDetailDto>;

public class ResetEmailTemplateCommandHandler(IApplicationDbContext db, IEmailTemplateService templates)
    : IRequestHandler<ResetEmailTemplateCommand, EmailTemplateDetailDto>
{
    public async Task<EmailTemplateDetailDto> Handle(ResetEmailTemplateCommand request, CancellationToken ct)
    {
        var t = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Code == request.Code, ct)
            ?? throw new NotFoundException("EmailTemplate", request.Code);

        t.Subject = t.DefaultSubject;
        t.BodyText = t.DefaultBodyText;
        await db.SaveChangesAsync(ct);
        templates.Invalidate(t.Code); // drop the cached copy so renders pick up the reset

        return new EmailTemplateDetailDto(
            t.Id, t.Code, t.Name, t.Audience, t.Subject, t.BodyText,
            t.DefaultSubject, t.DefaultBodyText, t.Placeholders, t.UpdatedAt,
            false);
    }
}
