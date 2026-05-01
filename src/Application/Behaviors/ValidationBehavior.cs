using FluentValidation;
using MediatR;
using ValidationException = AndritzVendorPortal.Application.Common.Exceptions.ValidationException;

namespace AndritzVendorPortal.Application.Behaviors;

public class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (!validators.Any())
            return await next();

        var ctx = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(validators.Select(v => v.ValidateAsync(ctx, cancellationToken)));

        var failures = results
            .Where(r => !r.IsValid)
            .SelectMany(r => r.Errors)
            .GroupBy(f => f.PropertyName, f => f.ErrorMessage)
            .ToDictionary(g => g.Key, g => g.ToArray());

        if (failures.Count > 0)
            throw new ValidationException(failures);

        return await next();
    }
}
