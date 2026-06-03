using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace AndritzVendorPortal.Application.Features.EmailTemplates.Commands;

public record UpdateEmailTemplateCommand(string Code, string Subject, string BodyText)
    : IRequest<EmailTemplateDetailDto>;

public class UpdateEmailTemplateCommandValidator : AbstractValidator<UpdateEmailTemplateCommand>
{
    public UpdateEmailTemplateCommandValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.BodyText).NotEmpty().MaximumLength(10000);
    }
}

public class UpdateEmailTemplateCommandHandler(IApplicationDbContext db, IEmailTemplateService templates)
    : IRequestHandler<UpdateEmailTemplateCommand, EmailTemplateDetailDto>
{
    public async Task<EmailTemplateDetailDto> Handle(UpdateEmailTemplateCommand request, CancellationToken ct)
    {
        var t = await db.EmailTemplates.FirstOrDefaultAsync(x => x.Code == request.Code, ct)
            ?? throw new NotFoundException("EmailTemplate", request.Code);

        t.Subject = request.Subject.Trim();
        t.BodyText = request.BodyText.TrimEnd();
        await db.SaveChangesAsync(ct);
        templates.Invalidate(t.Code); // drop the cached copy so renders pick up the edit

        return new EmailTemplateDetailDto(
            t.Id, t.Code, t.Name, t.Audience, t.Subject, t.BodyText,
            t.DefaultSubject, t.DefaultBodyText, t.Placeholders, t.UpdatedAt,
            t.Subject != t.DefaultSubject || t.BodyText != t.DefaultBodyText);
    }
}
