using AndritzVendorPortal.API.Data;
using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

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
    options.Password.RequireDigit           = true;
    options.Password.RequiredLength         = 8;
    options.Password.RequireNonAlphanumeric = true;
    options.Password.RequireUppercase       = true;
    options.Password.RequireLowercase       = true;
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

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException("Jwt:Key environment variable is not configured. Set Jwt__Key on the host.");

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

// ── 4. RATE LIMITING ──────────────────────────────────────────────────────────
// Login endpoint: max 10 attempts per minute per IP. Excess returns 429.
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", cfg =>
    {
        cfg.PermitLimit    = 10;
        cfg.Window         = TimeSpan.FromMinutes(1);
        cfg.QueueLimit     = 0;
        cfg.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var app = builder.Build();

// ── 5. MIDDLEWARE PIPELINE ───────────────────────────────────────────────────

var allowedOrigins = builder.Configuration
    .GetSection("AllowedOrigins").Get<string[]>() ?? [];

// Raw CORS middleware — fires first AND last (via OnStarting) so nothing downstream can wipe headers.
app.Use(async (ctx, next) =>
{
    var origin = ctx.Request.Headers.Origin.ToString();
    bool isAllowed = allowedOrigins.Contains(origin)
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

    try
    {
        await next();
    }
    catch (Exception ex)
    {
        // Without this catch, Kestrel resets the TCP connection on unhandled exceptions,
        // which the browser misreports as a CORS error. Return a proper 500 instead.
        if (!ctx.Response.HasStarted)
        {
            ctx.Response.StatusCode  = 500;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(
                $"{{\"error\":\"Internal server error: {ex.Message.Replace("\"", "'")}\"}}");
        }
    }
});

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

// ── 6. ENSURE DB SCHEMA EXISTS ───────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // Step 1: ensure base schema
    try { context.Database.EnsureCreated(); }
    catch (Exception ex) { Console.Error.WriteLine($"[STARTUP] EnsureCreated failed: {ex.Message}"); }

    // Step 2: add new columns/indexes — each statement isolated so one failure doesn't block the other
    foreach (var sql in new[]
    {
        """ALTER TABLE "VendorRequests" ADD COLUMN IF NOT EXISTS "IsOneTimeVendor" boolean NOT NULL DEFAULT false""",
        """ALTER TABLE "VendorRequests" ADD COLUMN IF NOT EXISTS "ProposedBy" text NOT NULL DEFAULT ''""",
        // Partial unique index: vendor codes must be unique among non-null values (fixes TOCTOU race)
        """CREATE UNIQUE INDEX IF NOT EXISTS "IX_VendorRequests_VendorCode" ON "VendorRequests" ("VendorCode") WHERE "VendorCode" IS NOT NULL""",
        // Index on ApproverUserId for faster pending-step lookups
        """CREATE INDEX IF NOT EXISTS "IX_ApprovalSteps_ApproverUserId" ON "ApprovalSteps" ("ApproverUserId")""",
    })
    {
        try { context.Database.ExecuteSqlRaw(sql); }
        catch (Exception ex) { Console.Error.WriteLine($"[STARTUP] Migration failed ({sql[..60]}…): {ex.Message}"); }
    }

    // Step 3: ensure roles
    try
    {
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Buyer", "Approver", "FinalApprover", "Admin" })
        {
            if (!roleManager.RoleExistsAsync(role).GetAwaiter().GetResult())
                roleManager.CreateAsync(new IdentityRole(role)).GetAwaiter().GetResult();
        }
    }
    catch (Exception ex) { Console.Error.WriteLine($"[STARTUP] Role seeding failed: {ex.Message}"); }

}

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Run($"http://0.0.0.0:{port}");