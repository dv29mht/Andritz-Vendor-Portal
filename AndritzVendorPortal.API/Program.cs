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

// ── Static Seeder Class ──────────────────────────────────────────────────────
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

        // 1. Create the Roles first!
        string[] roleNames = { "Buyer", "Approver", "FinalApprover", "Admin" };
        foreach (var roleName in roleNames)
        {
            if (!roleManager.RoleExistsAsync(roleName).GetAwaiter().GetResult())
            {
                roleManager.CreateAsync(new IdentityRole(roleName)).GetAwaiter().GetResult();
            }
        }

        if (!userManager.Users.Any())
        {
            // 2. Create Vikram
            var vikram = new ApplicationUser { 
                UserName = "vikram.nair@andritz.com", 
                Email = "vikram.nair@andritz.com",
                FullName = "Vikram Nair",
                Designation = "Buyer" 
            };
            userManager.CreateAsync(vikram, "Buyer@123!").GetAwaiter().GetResult();
            userManager.AddToRoleAsync(vikram, "Buyer").GetAwaiter().GetResult(); // 👈 THIS FIXES THE 403

            // 3. Create Rajesh
            var rajesh = new ApplicationUser { 
                UserName = "rajesh.kumar@andritz.com", 
                Email = "rajesh.kumar@andritz.com",
                FullName = "Rajesh Kumar",
                Designation = "Approver" 
            };
            userManager.CreateAsync(rajesh, "Approver@123!").GetAwaiter().GetResult();
            userManager.AddToRoleAsync(rajesh, "Approver").GetAwaiter().GetResult(); // 👈 THIS FIXES THE 403
        }
    }
}