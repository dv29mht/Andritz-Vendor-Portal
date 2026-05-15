using AndritzVendorPortal.Application.Interfaces;
using MediatR;

namespace AndritzVendorPortal.Application.Features.EmailTemplates.Queries;

public record PreviewEmailTemplateResult(string Subject, string HtmlBody);

public record PreviewEmailTemplateQuery(string Code, Dictionary<string, string?>? Values = null)
    : IRequest<PreviewEmailTemplateResult>;

public class PreviewEmailTemplateQueryHandler(IEmailTemplateService templates)
    : IRequestHandler<PreviewEmailTemplateQuery, PreviewEmailTemplateResult>
{
    public async Task<PreviewEmailTemplateResult> Handle(PreviewEmailTemplateQuery request, CancellationToken ct)
    {
        var values = request.Values ?? new Dictionary<string, string?>();
        var (subject, body) = await templates.RenderAsync(request.Code, values, ct);
        return new PreviewEmailTemplateResult(subject, body);
    }
}
