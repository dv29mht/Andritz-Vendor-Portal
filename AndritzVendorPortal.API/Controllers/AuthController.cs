using AndritzVendorPortal.API.DTOs;
using AndritzVendorPortal.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AndritzVendorPortal.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await userManager.FindByEmailAsync(dto.Email);

        // Check archived before lockout so we don't leak account existence
        if (user is not null && user.IsArchived)
            return Unauthorized(new { message = "This account has been deactivated. Contact your administrator." });

        // Use SignInManager so failed attempts increment the lockout counter
        if (user is null)
        {
            // Still perform a dummy check to keep constant-time behaviour
            await userManager.CheckPasswordAsync(new ApplicationUser(), dto.Password);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var result = await signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
            return StatusCode(429, new { message = "Account locked due to too many failed attempts. Try again in 15 minutes." });
        if (!result.Succeeded)
            return Unauthorized(new { message = "Invalid email or password." });

        var roles = (await userManager.GetRolesAsync(user)).ToList();

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new("name",                        user.FullName),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
        };

        // Add each role as a separate claim so ASP.NET Core's role checks work
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                          configuration["Jwt:Key"]!));
        var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(8);

        var token = new JwtSecurityToken(
            issuer:             configuration["Jwt:Issuer"],
            audience:           configuration["Jwt:Audience"],
            claims:             claims,
            expires:            expires,
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        var csrfToken   = Guid.NewGuid().ToString("N");

        // auth_token: httpOnly so JS cannot read it (XSS protection)
        Response.Cookies.Append("auth_token", tokenString, new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.None,
            Path     = "/",
            Expires  = expires,
        });

        // csrf_token: NOT httpOnly so JS can read it and attach as X-CSRF-Token header
        Response.Cookies.Append("csrf_token", csrfToken, new CookieOptions
        {
            HttpOnly = false,
            Secure   = true,
            SameSite = SameSiteMode.None,
            Path     = "/",
            Expires  = expires,
        });

        return Ok(new AuthResponseDto(
            ExpiresAt: expires,
            User:      new AuthUserDto(user.Id, user.Email!, user.FullName, roles, user.Designation)));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var expired = new CookieOptions
        {
            HttpOnly = true,
            Secure   = true,
            SameSite = SameSiteMode.None,
            Path     = "/",
            Expires  = DateTime.UtcNow.AddDays(-1),
        };
        Response.Cookies.Append("auth_token", "", expired);
        Response.Cookies.Append("csrf_token", "", new CookieOptions
        {
            HttpOnly = false,
            Secure   = true,
            SameSite = SameSiteMode.None,
            Path     = "/",
            Expires  = DateTime.UtcNow.AddDays(-1),
        });
        return Ok();
    }
}
