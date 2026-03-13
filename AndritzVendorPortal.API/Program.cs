using AndritzVendorPortal.API.Data;
using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// ── 1. DATABASE CONFIGURATION (PostgreSQL on Render, SQLite Locally) ─────────
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (!string.IsNullOrEmpty(databaseUrl))
    {
        var uri = new Uri(databaseUrl);
        var userInfo = uri.UserInfo.Split(':', 2);
        var csb = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = userInfo[0],
            Password = Uri.UnescapeDataString(userInfo.Length > 1 ? userInfo[1] : ""),
            SslMode = SslMode.Require
        };
        options.UseNpgsql(csb.ConnectionString);
    }
    else
    {
        options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"));
    }
});

// ── 2. IDENTITY & AUTHENTICATION ──────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// Prevent Identity's cookie auth from redirecting API requests to /Account/Login.
// Without this, unauthenticated API calls get a 302 redirect instead of 401.
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

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");

// Explicitly override all three scheme defaults so AddIdentity's cookie scheme
// cannot intercept authenticated API requests.
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme             = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer           = true,
        ValidateAudience         = true,
        ValidateLifetime         = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer              = builder.Configuration["Jwt:Issuer"],
        ValidAudience            = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

// ── 3. POLICIES & API SERVICES ───────────────────────────────────────────────
builder.Services.AddSingleton<IAuthorizationHandler, FinalApproverHandler>();
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.FinalApproverOnly, policy => {
        policy.RequireAuthenticatedUser()
              .RequireRole(Roles.FinalApprover)
              .AddRequirements(new FinalApproverRequirement());
    });

builder.Services.AddControllers().AddJsonOptions(opts => {
    opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

var app = builder.Build();

// ── 5. MIDDLEWARE PIPELINE ───────────────────────────────────────────────────

// Raw CORS middleware — fires first AND last (via OnStarting) so nothing downstream can wipe headers.
app.Use(async (ctx, next) =>
{
    var origin = ctx.Request.Headers.Origin.ToString();
    bool isAllowed = origin == "https://andritz-portal-live.vercel.app"
                  || origin == "http://localhost:5173"
                  || (origin.StartsWith("https://andritz-portal-live-") && origin.EndsWith(".vercel.app"));

    // Set headers now (before pipeline runs)
    if (isAllowed)
    {
        ctx.Response.Headers["Access-Control-Allow-Origin"]      = origin;
        ctx.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        ctx.Response.Headers["Access-Control-Allow-Methods"]     = "GET,POST,PUT,DELETE,OPTIONS,PATCH";
        ctx.Response.Headers["Access-Control-Allow-Headers"]     = "Authorization,Content-Type,Accept";
        ctx.Response.Headers["Vary"]                             = "Origin";
    }

    // Re-apply just before headers are flushed — catches anything that cleared them downstream
    ctx.Response.OnStarting(() =>
    {
        if (isAllowed)
        {
            ctx.Response.Headers["Access-Control-Allow-Origin"]      = origin;
            ctx.Response.Headers["Access-Control-Allow-Credentials"] = "true";
            ctx.Response.Headers["Access-Control-Allow-Methods"]     = "GET,POST,PUT,DELETE,OPTIONS,PATCH";
            ctx.Response.Headers["Access-Control-Allow-Headers"]     = "Authorization,Content-Type,Accept";
            ctx.Response.Headers["Vary"]                             = "Origin";
        }
        return Task.CompletedTask;
    });

    if (ctx.Request.Method == "OPTIONS")
    {
        ctx.Response.StatusCode = 204;
        return;
    }
    await next();
});

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

// ── 6. ENSURE DB SCHEMA EXISTS ───────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    context.Database.EnsureCreated();

    // Ensure all 4 roles exist (required for Admin to create users via the UI)
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in new[] { "Buyer", "Approver", "FinalApprover", "Admin" })
    {
        if (!roleManager.RoleExistsAsync(role).GetAwaiter().GetResult())
            roleManager.CreateAsync(new IdentityRole(role)).GetAwaiter().GetResult();
    }
}

app.Run();