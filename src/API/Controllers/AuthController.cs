using AndritzVendorPortal.Application.Common.Models;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Features.Auth.Commands;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AndritzVendorPortal.API.Controllers;

public record LoginRequestModel(string Email, string Password);
public record ForgotPasswordRequestModel(string Email);
public record ResetPasswordRequestModel(string Email, string Token, string NewPassword);

[ApiController]
[Route("api/auth")]
public class AuthController(IMediator mediator) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<Result<AuthResponseDto>>> Login([FromBody] LoginRequestModel model)
    {
        var result = await mediator.Send(new LoginCommand(model.Email, model.Password));

        // Set httpOnly auth cookie + readable CSRF cookie (matches existing frontend)
        var common = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = result.ExpiresAt
        };
        Response.Cookies.Append("auth_token", result.Token, common);
        Response.Cookies.Append("csrf_token", result.CsrfToken, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = result.ExpiresAt
        });

        return Ok(Result<AuthResponseDto>.Ok(result));
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<Result>> ForgotPassword([FromBody] ForgotPasswordRequestModel model)
    {
        await mediator.Send(new ForgotPasswordCommand(model.Email));
        return Ok(Result.Ok("If that email is registered, a reset link has been sent."));
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult<Result>> ResetPassword([FromBody] ResetPasswordRequestModel model)
    {
        await mediator.Send(new ResetPasswordCommand(model.Email, model.Token, model.NewPassword));
        return Ok(Result.Ok("Password reset successfully. You can now sign in."));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var expired = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = DateTime.UtcNow.AddDays(-1)
        };
        Response.Cookies.Append("auth_token", string.Empty, expired);
        Response.Cookies.Append("csrf_token", string.Empty, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.None,
            Path = "/",
            Expires = DateTime.UtcNow.AddDays(-1)
        });
        return Ok(Result.Ok());
    }
}
