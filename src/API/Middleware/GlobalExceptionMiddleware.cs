using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.Common.Models;
using System.Net;
using System.Text.Json;

namespace AndritzVendorPortal.API.Middleware;

/// <summary>
/// Catches all exceptions thrown by handlers and maps them to consistent
/// JSON error responses using the Result envelope.
/// </summary>
public class GlobalExceptionMiddleware(
    RequestDelegate next,
    ILogger<GlobalExceptionMiddleware> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (Exception ex)
        {
            await HandleAsync(ctx, ex);
        }
    }

    private async Task HandleAsync(HttpContext ctx, Exception ex)
    {
        var (status, message, errors) = Map(ex);

        if (status >= 500)
            logger.LogError(ex, "[Unhandled] {Path}", ctx.Request.Path);

        if (ctx.Response.HasStarted)
            return;

        ctx.Response.ContentType = "application/json";
        ctx.Response.StatusCode = status;

        var body = Result.Fail(message, errors);
        await ctx.Response.WriteAsync(JsonSerializer.Serialize(body, JsonOpts));
    }

    private static (int Status, string Message, IReadOnlyList<string> Errors) Map(Exception ex) => ex switch
    {
        ValidationException ve => (
            (int)HttpStatusCode.BadRequest,
            "Validation failed",
            ve.Errors.SelectMany(kv => kv.Value.Select(v => $"{kv.Key}: {v}")).ToList()),
        BadRequestException br => ((int)HttpStatusCode.BadRequest, br.Message, br.Errors),
        UnauthorizedException ue => ((int)HttpStatusCode.Unauthorized, ue.Message, []),
        ForbiddenException fe => ((int)HttpStatusCode.Forbidden, fe.Message, []),
        NotFoundException nf => ((int)HttpStatusCode.NotFound, nf.Message, []),
        ConflictException cf => ((int)HttpStatusCode.Conflict, cf.Message, []),
        AppException ae => ((int)HttpStatusCode.BadRequest, ae.Message, []),
        _ => ((int)HttpStatusCode.InternalServerError, "An unexpected error occurred.", [])
    };
}
