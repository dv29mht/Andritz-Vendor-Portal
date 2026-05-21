using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Infrastructure.Authentication;
using AndritzVendorPortal.Infrastructure.Identity;
using AndritzVendorPortal.Infrastructure.Persistence;
using AndritzVendorPortal.Infrastructure.Persistence.Repositories;
using AndritzVendorPortal.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AndritzVendorPortal.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(connectionString, sql =>
                sql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());

        // Identity
        services.AddIdentity<ApplicationUser, IdentityRole>(options =>
        {
            options.Password.RequireDigit = true;
            options.Password.RequiredLength = 8;
            options.Password.RequireNonAlphanumeric = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireLowercase = true;
            options.User.RequireUniqueEmail = true;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            options.Lockout.MaxFailedAccessAttempts = 10;
            options.Lockout.AllowedForNewUsers = true;
        })
        .AddEntityFrameworkStores<ApplicationDbContext>()
        .AddDefaultTokenProviders();

        // Repositories
        services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
        services.AddScoped<IVendorRequestRepository, VendorRequestRepository>();

        // Services
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ILoginSecurityService, LoginSecurityService>();

        services.Configure<JwtSettings>(config.GetSection("JwtSettings"));
        services.Configure<EmailSettings>(config.GetSection("EmailSettings"));
        services.AddHttpClient();
        services.AddScoped<IEmailService, BrevoEmailService>();
        services.AddScoped<IEmailTemplateService, EmailTemplateService>();
        services.AddSingleton<IVendorRequestPdfService, QuestPdfVendorRequestPdfService>();
        services.AddSingleton<IEmailActionTokenService, EmailActionTokenService>();

        // JWT token validation
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
             .AddJwtBearer(opt =>
             {
                 opt.TokenValidationParameters = new TokenValidationParameters
                 {
                     ValidateIssuerSigningKey = true,
                     IssuerSigningKey = new SymmetricSecurityKey(
                     Encoding.UTF8.GetBytes(config["JwtSettings:SecretKey"])),
                     ValidateIssuer = false,
                     ValidateAudience = false,
                     ValidateLifetime = true,
                     ValidIssuer = config["JwtSettings:Issuer"],
                     ValidAudience = config["JwtSettings:Audience"],
                     // ClockSkew = 0 — required for the iat-vs-TokensValidSince
                     // revocation check below to be precise to the second.
                     ClockSkew = TimeSpan.Zero
                 };

                 // Per-request revocation check: every JWT carries an `iat`
                 // (issued-at) claim; we reject the token if any role it
                 // claims has been revoked (LoginSecurity.TokensValidSince > iat).
                 // This is how logout-everywhere, password-change, and
                 // role-revocation invalidate prior sessions.
                 opt.Events = new JwtBearerEvents
                 {
                     OnTokenValidated = OnJwtTokenValidated
                 };
             });

        return services;
    }

    // Compares the token's `iat` against LoginSecurity.TokensValidSince for
    // each role claim. If any matching row was bumped after the token was
    // issued, the token is treated as revoked and the request fails 401.
    // Tokens without an iat claim are also rejected — every token we issue
    // includes one (see JwtTokenService).
    private static async Task OnJwtTokenValidated(TokenValidatedContext ctx)
    {
        var principal = ctx.Principal;
        if (principal is null)
        {
            ctx.Fail("Missing principal.");
            return;
        }

        var iatClaim = principal.FindFirst(JwtRegisteredClaimNames.Iat)?.Value;
        if (string.IsNullOrEmpty(iatClaim) || !long.TryParse(iatClaim, out var iatUnix))
        {
            ctx.Fail("Token missing iat claim.");
            return;
        }
        var issuedAt = DateTimeOffset.FromUnixTimeSeconds(iatUnix).UtcDateTime;

        var userId = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                     ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            ctx.Fail("Token missing subject.");
            return;
        }

        var roles = principal.FindAll(ClaimTypes.Role).Select(c => c.Value).ToArray();
        if (roles.Length == 0) return; // Nothing role-scoped to revoke against.

        var loginSecurity = ctx.HttpContext.RequestServices
            .GetRequiredService<ILoginSecurityService>();

        foreach (var role in roles)
        {
            var validSince = await loginSecurity.GetTokensValidSinceAsync(userId, role, ctx.HttpContext.RequestAborted);
            if (validSince is { } cutoff && issuedAt < cutoff)
            {
                var logger = ctx.HttpContext.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("JwtRevocation");
                logger.LogInformation(
                    "Rejecting revoked token for user {UserId} role {Role}: iat={Iat:o} < TokensValidSince={Cutoff:o}",
                    userId, role, issuedAt, cutoff);
                ctx.Fail("Token has been revoked.");
                return;
            }
        }
    }
}
