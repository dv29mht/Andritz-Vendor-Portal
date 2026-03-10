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

// ── Database ─────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Identity ─────────────────────────────────────────────────────────────────
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = true;
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured.");

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
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

// ── Authorization Policies ────────────────────────────────────────────────────
builder.Services.AddSingleton<IAuthorizationHandler, FinalApproverHandler>();

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.FinalApproverOnly, policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole(Roles.FinalApprover);
        policy.AddRequirements(new FinalApproverRequirement());
    });

// ── API & CORS ────────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

// ── Middleware Pipeline ───────────────────────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ⚠️ ORDER MATTERS HERE
app.UseRouting();

app.UseCors("AllowReactApp"); 

app.UseAuthentication();
app.UseAuthorization();

// ── Data Seeding ─────────────────────────────────────────────────────────────
// This must happen after builder.Build but BEFORE app.Run
DbInitializer.SeedData(app);

app.MapControllers();

// 🏁 THE ONLY RUN CALL
app.Run();

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

        // 1. Ensure ALL Roles exist
        string[] roleNames = { "Buyer", "Approver", "FinalApprover", "Admin" };
        foreach (var roleName in roleNames)
        {
            if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult())
            {
                roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
            }
        }

        // 2. Create and Role-Link EACH user if they don't exist
        SeedUser(userManager, "vikram.nair@andritz.com", "Vikram Nair", "Buyer", "Buyer@123!");
        SeedUser(userManager, "rajesh.kumar@andritz.com", "Rajesh Kumar", "Approver", "Approver@123!");
        SeedUser(userManager, "pardeep.sharma@andritz.com", "Pardeep Sharma", "FinalApprover", "ChangeMe1!");
        SeedUser(userManager, "admin@andritz.com", "System Admin", "Admin", "Admin@123!");

        context.SaveChanges();
    }

    private static void SeedUser(UserManager<ApplicationUser> userManager, string email, string name, string role, string password)
    {
        var user = userManager.FindByEmailAsync(email).GetAwaiter().GetResult();
        if (user == null)
        {
            user = new ApplicationUser 
            { 
                UserName = email, 
                Email = email, 
                FullName = name, 
                Designation = role,
                NormalizedUserName = email.ToUpper(),
                NormalizedEmail = email.ToUpper(),
                EmailConfirmed = true 
            };
            var result = userManager.CreateAsync(user, password).GetAwaiter().GetResult();
            if (result.Succeeded)
            {
                userManager.AddToRoleAsync(user, role).GetAwaiter().GetResult();
                Console.WriteLine($"Successfully seeded and role-linked: {email}");
            }
        }
    }
}