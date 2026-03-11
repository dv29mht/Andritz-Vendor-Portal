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

// Raw CORS middleware — runs before everything, writes headers directly.
// Bypasses the standard CORS machinery so nothing in the pipeline can interfere.
app.Use(async (ctx, next) =>
{
    string[] allowed = [
        "https://andritz-portal-live.vercel.app",
        "https://andritz-portal-live-43ye0gdsh-dv29mhts-projects.vercel.app",
        "http://localhost:5173"
    ];
    var origin = ctx.Request.Headers.Origin.ToString();
    if (allowed.Contains(origin))
    {
        ctx.Response.Headers["Access-Control-Allow-Origin"]      = origin;
        ctx.Response.Headers["Access-Control-Allow-Credentials"] = "true";
        ctx.Response.Headers["Access-Control-Allow-Methods"]     = "GET,POST,PUT,DELETE,OPTIONS,PATCH";
        ctx.Response.Headers["Access-Control-Allow-Headers"]     = "Authorization,Content-Type,Accept";
        ctx.Response.Headers["Vary"]                             = "Origin";
    }
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

// ── 6. SEED DATA ────────────────────────────────────────────────────────────
try 
{
    Console.WriteLine("🚀 Seeding database...");
    DbInitializer.SeedData(app);
}
catch (Exception ex)
{
    Console.WriteLine($"⚠️ Seeding failed: {ex.Message}");
}

app.Run();

// ── 7. THE SEEDER CLASS ──────────────────────────────────────────────────────
public static class DbInitializer
{
    public static void SeedData(IHost host)
    {
        using var scope = host.Services.CreateScope();
        var services = scope.ServiceProvider;
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var context = services.GetRequiredService<ApplicationDbContext>();

        context.Database.EnsureCreated();

        string[] roleNames = { "Buyer", "Approver", "FinalApprover", "Admin" };
        foreach (var roleName in roleNames)
        {
            if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult())
                roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
        }

        var seedData = new[] {
            (Email: "vikram.nair@andritz.com", Name: "Vikram Nair", Role: "Buyer", Pass: "Buyer@123!"),
            (Email: "rajesh.kumar@andritz.com", Name: "Rajesh Kumar", Role: "Approver", Pass: "Approver@123!"),
            (Email: "pardeep.sharma@andritz.com", Name: "Pardeep Sharma", Role: "FinalApprover", Pass: "Change@Me1!"),
            (Email: "sunita.rao@andritz.com", Name: "Sunita Rao", Role: "Admin", Pass: "Admin@123!")
        };

        foreach (var data in seedData)
        {
            var user = userManager.FindByEmailAsync(data.Email).GetAwaiter().GetResult();
            if (user == null)
            {
                // First-time creation
                user = new ApplicationUser {
                    UserName = data.Email, Email = data.Email, FullName = data.Name,
                    Designation = data.Role, EmailConfirmed = true,
                    NormalizedUserName = data.Email.ToUpper(), NormalizedEmail = data.Email.ToUpper()
                };
                var result = userManager.CreateAsync(user, data.Pass).GetAwaiter().GetResult();
                if (result.Succeeded)
                    userManager.AddToRoleAsync(user, data.Role).GetAwaiter().GetResult();
            }
            else
            {
                // User already exists — force-reset password without deleting (avoids FK violations)
                var token = userManager.GeneratePasswordResetTokenAsync(user).GetAwaiter().GetResult();
                userManager.ResetPasswordAsync(user, token, data.Pass).GetAwaiter().GetResult();
                // Ensure correct role
                if (!userManager.IsInRoleAsync(user, data.Role).GetAwaiter().GetResult())
                    userManager.AddToRoleAsync(user, data.Role).GetAwaiter().GetResult();
            }
        }
    }
}