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
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await userManager.FindByEmailAsync(dto.Email);
        if (user is null || !await userManager.CheckPasswordAsync(user, dto.Password))
            return Unauthorized(new { message = "Invalid email or password." });

        if (user.IsArchived)
            return Unauthorized(new { message = "This account has been deactivated. Contact your administrator." });

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

        return Ok(new AuthResponseDto(
            Token:     new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAt: expires,
            User:      new AuthUserDto(user.Id, user.Email!, user.FullName, roles, user.Designation)));
    }
}
