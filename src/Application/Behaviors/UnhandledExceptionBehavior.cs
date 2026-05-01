using AndritzVendorPortal.Application.Common.Exceptions;
using MediatR;
using Microsoft.Extensions.Logging;

namespace AndritzVendorPortal.Application.Behaviors;

/// <summary>
/// Logs unexpected exceptions thrown by handlers. Domain exceptions
/// (NotFoundException, ConflictException, etc.) are passed through untouched
/// so the global middleware can map them to HTTP status codes.
/// </summary>
public class UnhandledExceptionBehavior<TRequest, TResponse>(
    ILogger<UnhandledExceptionBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        try
        {
            return await next();
        }
        catch (AppException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[Unhandled] {RequestName}", typeof(TRequest).Name);
            throw;
        }
    }
}
