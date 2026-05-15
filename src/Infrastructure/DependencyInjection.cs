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
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace AndritzVendorPortal.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

        // ServerVersion.AutoDetect needs a reachable server; for first-run scenarios
        // (DB does not yet exist) we fall back to a pinned MySQL 8.0 version so the
        // app can boot and create the schema. Override via ConnectionStrings:MySqlVersion
        // if you need to target a specific server build.
        var mysqlVersion = config["MySqlServerVersion"];
        ServerVersion serverVersion;
        try
        {
            serverVersion = !string.IsNullOrWhiteSpace(mysqlVersion)
                ? ServerVersion.Parse(mysqlVersion)
                : ServerVersion.AutoDetect(connectionString);
        }
        catch
        {
            serverVersion = new MySqlServerVersion(new Version(8, 0, 36));
        }

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseMySql(connectionString, serverVersion, mysql =>
                mysql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));

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

        services.Configure<JwtSettings>(config.GetSection("Jwt"));
        services.Configure<EmailSettings>(config.GetSection("EmailSettings"));
        services.AddHttpClient();
        services.AddScoped<IEmailService, BrevoEmailService>();
        services.AddScoped<IEmailTemplateService, EmailTemplateService>();
        services.AddSingleton<IVendorRequestPdfService, QuestPdfVendorRequestPdfService>();
        services.AddSingleton<IEmailActionTokenService, EmailActionTokenService>();

        // JWT bearer (default scheme — overrides Identity's cookie default)
        var jwtSection = config.GetSection("Jwt");
        var jwtKey = jwtSection["Key"];

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSection["Issuer"],
                ValidAudience = jwtSection["Audience"],
                IssuerSigningKey = string.IsNullOrWhiteSpace(jwtKey)
                    ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes("PLACEHOLDER_KEY_REPLACE_VIA_CONFIG"))
                    : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    // SignalR cannot set Authorization headers on the WebSocket
                    // handshake, so clients pass the JWT as ?access_token=... on
                    // requests to /hubs/*. Accept it there.
                    var path = ctx.HttpContext.Request.Path;
                    var accessToken = ctx.Request.Query["access_token"].ToString();
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        ctx.Token = accessToken;
                        return Task.CompletedTask;
                    }

                    if (string.IsNullOrEmpty(ctx.Token) &&
                        ctx.Request.Cookies.TryGetValue("auth_token", out var cookieToken))
                        ctx.Token = cookieToken;
                    return Task.CompletedTask;
                }
            };
        });

        return services;
    }
}
