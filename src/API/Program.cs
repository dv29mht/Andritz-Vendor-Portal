using AndritzVendorPortal.API.Authorization;
using AndritzVendorPortal.API.Hubs;
using AndritzVendorPortal.API.Json;
using AndritzVendorPortal.API.Middleware;
using AndritzVendorPortal.API.Services;
using AndritzVendorPortal.Application;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Infrastructure;
using AndritzVendorPortal.Infrastructure.Identity;
using AndritzVendorPortal.Infrastructure.Persistence;
using AndritzVendorPortal.Infrastructure.Persistence.Seed;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;
using Serilog;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──────────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .CreateLogger();
builder.Host.UseSerilog();

// ── Layers ───────────────────────────────────────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ── API plumbing ─────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// SignalR + transport-agnostic INotificationService implementation. Command
// handlers depend only on the Application-layer interface; this wires the
// SignalR-backed impl in the API project where the Hub lives.
builder.Services.AddSignalR();
builder.Services.AddScoped<INotificationService, SignalRNotificationService>();

builder.Services.AddSingleton<IAuthorizationHandler, FinalApproverHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.FinalApproverOnly, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(Roles.FinalApprover)
        .AddRequirements(new FinalApproverRequirement()));
});

// Make Identity cookie auth return 401/403 instead of redirecting to /Account/Login
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

builder.Services.AddControllers().AddJsonOptions(opts =>
{
    opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    opts.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
    opts.JsonSerializerOptions.Converters.Add(new UtcNullableDateTimeConverter());
});
builder.Services.AddFluentValidationAutoValidation();

// CORS registered inline at UseCors below.

// Rate limiting — login endpoint
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", cfg =>
    {
        cfg.PermitLimit = 10;
        cfg.Window = TimeSpan.FromMinutes(1);
        cfg.QueueLimit = 0;
        cfg.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Swagger + JWT bearer
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Andritz Vendor Portal API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header. Example: 'Bearer {token}'"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ── Middleware pipeline ──────────────────────────────────────────────────────
app.UseSerilogRequestLogging();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

// Sub-path hosting (e.g. office IIS at /SOT). Must come before UseStaticFiles
// and UseRouting so the prefix is stripped from PathBase before any matching.
// Empty/unset → no-op, app serves at root (Railway, local dev).
var pathBase = builder.Configuration["App:PathBase"];
if (!string.IsNullOrWhiteSpace(pathBase))
{
    app.UsePathBase(pathBase);
}

// Serve the React SPA from wwwroot so a single origin hosts both the API
// (/api, /swagger, /hubs) and the frontend (/, /assets/*, client routes).
// MapFallbackToFile below sends any unmatched GET to index.html for React Router.
//
// Cache policy is critical for a hashed-asset SPA: index.html must NEVER be
// cached, or after a redeploy the browser keeps a stale index.html that points
// at asset hashes the server no longer has — producing blank styles, MIME
// errors, and stale JS. The /assets/* files ARE content-hashed, so they are
// safe to cache forever (immutable). The same options are reused by
// MapFallbackToFile below so client-route requests also get no-cache HTML.
var spaStaticFileOptions = new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        if (ctx.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
        {
            headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
            headers["Pragma"] = "no-cache";
            headers["Expires"] = "0";
        }
        else if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
        {
            headers["Cache-Control"] = "public, max-age=31536000, immutable";
        }
    },
};

app.UseDefaultFiles();
app.UseStaticFiles(spaStaticFileOptions);

if (app.Configuration.GetValue("Swagger:Enabled", true))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Andritz Vendor Portal API v1"));
}

app.UseRouting();
app.UseCors(x => x.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
app.UseAuthentication();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();
app.MapHub<AndritzVendorPortal.API.Hubs.NotificationHub>("/hubs/notifications");
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", timestamp = DateTime.UtcNow }))
    .AllowAnonymous();

// SPA fallback — any GET that didn't match a controller, hub, or static file
// returns index.html so React Router can resolve client-side routes like /login.
app.MapFallbackToFile("index.html", spaStaticFileOptions);

// Honour Railway/Docker conventions: PORT env var wins, else ASPNETCORE_URLS,
// else Kestrel's default. This avoids fighting with ASPNETCORE_URLS in the container.
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
    app.Urls.Add($"http://0.0.0.0:{port}");

// ── Migrate + seed DB (fail-fast) ────────────────────────────────────────────
// Block startup on migration + seed so a half-migrated DB can never serve
// traffic — a SPA that loads but whose every API call 500s is the failure
// mode we want to avoid. If MigrateAsync throws, the process exits and the
// orchestrator (Railway/IIS) keeps the previous version live.
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var bootLogger = services.GetRequiredService<ILogger<Program>>();
    bootLogger.LogInformation("[Boot] Starting database migration + seed");
    var context = services.GetRequiredService<ApplicationDbContext>();
    var users = services.GetRequiredService<UserManager<ApplicationUser>>();
    var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
    var defaultPw = app.Configuration["Seed:DefaultAdminPassword"] ?? "Andritz@1234";
    await DbInitializer.InitializeAsync(context, users, roles, bootLogger, defaultPw);
    bootLogger.LogInformation("[Boot] Database migration + seed complete");
}

app.Run();

public partial class Program { }
