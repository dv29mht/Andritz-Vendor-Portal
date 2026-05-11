namespace AndritzVendorPortal.API.Middleware;

/// <summary>
/// Double-submit cookie pattern: for state-changing requests from authenticated users,
/// the X-CSRF-Token header must match the csrf_token cookie. Auth endpoints are exempt.
/// </summary>
public class CsrfMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var method = ctx.Request.Method;
        bool isSafe = method is "GET" or "HEAD" or "OPTIONS";
        bool isAuthRoute = ctx.Request.Path.StartsWithSegments("/api/auth");
        // SignalR negotiate is a POST but the SignalR JS client can't attach our
        // X-CSRF-Token header. Hub paths are already authenticated via JWT
        // (?access_token=...), so CSRF protection is redundant and would block
        // every WebSocket handshake.
        bool isHubRoute = ctx.Request.Path.StartsWithSegments("/hubs");

        if (!isSafe && !isAuthRoute && !isHubRoute && ctx.User.Identity?.IsAuthenticated == true)
        {
            var header = ctx.Request.Headers["X-CSRF-Token"].ToString();
            var cookie = ctx.Request.Cookies["csrf_token"] ?? string.Empty;
            if (string.IsNullOrEmpty(header) || header != cookie)
            {
                ctx.Response.StatusCode = 403;
                ctx.Response.ContentType = "application/json";
                await ctx.Response.WriteAsync("{\"success\":false,\"message\":\"CSRF token validation failed.\",\"errors\":[]}");
                return;
            }
        }
        await next(ctx);
    }
}
