using AndritzVendorPortal.API.Data;
using AndritzVendorPortal.API.Infrastructure;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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
        // Use the helper to convert Render's URL to Npgsql format
        options.UseNpgsql(ConvertPostgresUrlToNpgsql(databaseUrl));
    }
    else
    {
        options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"));
    }
});

// ── 2. IDENTITY & AUTHENTICATION ──────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = true;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
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

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── 4. CORS (Matches your Vercel URLs) ───────────────────────────────────────
builder.Services.AddCors(options => {
    options.AddPolicy("AllowReactApp", policy => {
        policy.WithOrigins(
            "http://localhost:5173", 
            "https://andritz-portal-live.vercel.app",
            "https://andritz-portal-live-43ye0gdsh-dv29mhts-projects.vercel.app"
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

var app = builder.Build();

// ── 5. MIDDLEWARE PIPELINE ───────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors("AllowReactApp");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── 6. SEED DATA (Try/Catch ensures app starts even if DB is busy) ────────────
try 
{
    Console.WriteLine("🚀 Seeding database...");
    DbInitializer.SeedData(app);
}
catch (Exception ex)
{
    Console.WriteLine($"⚠️ Seeding skipped or failed: {ex.Message}");
}

app.Run();

// ── 7. HELPER FUNCTIONS ───────────────────────────────────────────────────────

static string ConvertPostgresUrlToNpgsql(string url)
{
    var uri = new Uri(url);
    var userInfo = uri.UserInfo.Split(':');
    return $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";
}

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

        // MATCHES FRONTEND EXACTLY: Fixing the "Account Not Found" error
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
                user = new ApplicationUser 
                { 
                    UserName = data.Email, Email = data.Email, FullName = data.Name, 
                    Designation = data.Role, EmailConfirmed = true,
                    NormalizedUserName = data.Email.ToUpper(), NormalizedEmail = data.Email.ToUpper()
                };
                var result = userManager.CreateAsync(user, data.Pass).GetAwaiter().GetResult();
                if (result.Succeeded) userManager.AddToRoleAsync(user, data.Role).GetAwaiter().GetResult();
            }
        }
    }
}