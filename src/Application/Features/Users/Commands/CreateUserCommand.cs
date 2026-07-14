using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Application.Services;
using AndritzVendorPortal.Domain.Constants;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace AndritzVendorPortal.Application.Features.Users.Commands;

public record CreateUserCommand(
    string FullName,
    string Email,
    string Password,
    string Role,
    string? Designation) : IRequest<UserDto>;

public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.Role).NotEmpty()
            .Must(r => Roles.AssignableByAdmin.Contains(r))
            .WithMessage($"Invalid role. Must be one of: {string.Join(", ", Roles.AssignableByAdmin)}.");
    }
}

public class CreateUserCommandHandler(
    IApplicationDbContext db,
    IIdentityService identity,
    IEmailOutbox outbox,
    IEmailTemplateService templates,
    IConfiguration config) : IRequestHandler<CreateUserCommand, UserDto>
{
    public async Task<UserDto> Handle(CreateUserCommand request, CancellationToken ct)
    {
        if (await identity.FindByEmailAsync(request.Email) is not null)
            throw new ConflictException("A user with this email address already exists.");

        var portalUrl = config["PortalUrl"] ?? "http://localhost:5173";

        var inviteCode = request.Role switch
        {
            Roles.Buyer    => EmailTemplateCodes.BuyerInvitation,
            Roles.Approver => EmailTemplateCodes.ApproverInvitation,
            _              => null,
        };

        if (inviteCode is not null)
        {
            var values = new Dictionary<string, string?>
            {
                ["[Buyer Name]"]    = request.FullName,
                ["[Approver Name]"] = request.FullName,
                ["[Email]"]         = request.Email,
                ["[Password]"]      = request.Password,
                ["[Portal URL]"]    = portalUrl,
            };
            var (subject, body) = await templates.RenderAsync(inviteCode, values, ct);
            outbox.Enqueue(request.Email, subject, body);
        }
        else
        {
            // Admin (and any future non-spec role) — keep the legacy generic welcome template.
            var (subject, body) = LegacyEmailTemplates.WelcomeUser(
                request.FullName, request.Email, request.Role, portalUrl);
            outbox.Enqueue(request.Email, subject, body);
        }

        // Stage the invite BEFORE creating the account, so the two commit together.
        //
        // Identity is stored in this very DbContext (AddEntityFrameworkStores<ApplicationDbContext>,
        // scoped — IdentityService and IApplicationDbContext resolve the same instance), so
        // UserManager.CreateAsync saves through it: the INSERT into AspNetUsers and the staged
        // OutboxEmails row go out in one SaveChanges, and therefore one transaction. Queue-then-create
        // is what makes that true. The other order — create, then queue, then save — is two commits,
        // and if the second throws the admin gets a 500 while the account exists un-invited, with no
        // way back: re-running "create user" fails on the duplicate email, and nothing retries the mail.
        //
        // A rejected password (Identity's policy is stricter than this command's validator) fails
        // inside CreateAsync before it ever saves, so the staged row is simply never persisted.
        // Residual: if CreateAsync commits and the subsequent AddToRoleAsync fails, IdentityService
        // deletes the user — and the invite, already committed, still goes out. That needs a missing
        // role, which the validator and the boot-time seed both rule out; and its cost is one invite
        // whose credentials don't work, against an account that is permanently unreachable.
        var (ok, userId, errors) = await identity.CreateUserAsync(
            request.Email, request.Password, request.FullName, request.Designation, request.Role);

        if (!ok)
            throw new BadRequestException("Failed to create user.", errors);

        // No-op when CreateAsync already flushed the staged row; the belt-and-braces matters only if
        // Identity is ever moved off this context, where it degrades to the old two-commit behaviour
        // rather than dropping the invite.
        await db.SaveChangesAsync(ct);

        return new UserDto(userId, request.FullName, request.Email, request.Designation ?? string.Empty, [request.Role]);
    }
}
