# Backend Architecture

This document is the source of truth for how the Andritz Vendor Portal backend is
structured. **Everything new must follow this.** When something deviates, fix the
deviation or update this document — don't add a third pattern.

---

## 1. Solution layout

Four projects under `/src/`, plus a test project at the repo root.

```
src/
├── Domain/            ← Pure business types. No outward deps.
├── Application/       ← CQRS use cases. Depends only on Domain.
├── Infrastructure/    ← EF Core, Identity, JWT, email. Depends on Application + Domain.
└── API/               ← Controllers, middleware, SignalR. Depends on all three.

AndritzVendorPortal.Tests/   ← xUnit tests against Domain + Application.
AndritzVendorPortal.Frontend/ ← React (unrelated to backend layout).
```

**Assembly names** are `AndritzVendorPortal.{Domain,Application,Infrastructure,API}`
even though the folders are short (`Domain/`, not `AndritzVendorPortal.Domain/`).
Set this via `<AssemblyName>` and `<RootNamespace>` in each `.csproj` — do not rename
the folders.

### Dependency rule

```
Domain  ←  Application  ←  Infrastructure  ←  API
              ↑                                 │
              └─────── (also referenced) ───────┘
```

**Application never references Infrastructure.** If a handler needs something
infrastructural (DB, JWT, email, SignalR), define an interface in
`Application/Interfaces/` and implement it in `Infrastructure/` or `API/`.

If you find yourself wanting to add `using AndritzVendorPortal.Infrastructure.*;`
inside the Application project, stop. Define an interface instead.

---

## 2. Layer responsibilities

### `Domain/` — pure business types

What lives here: entities, enums, value objects, marker interfaces, role/policy
name constants, **pure** domain services (like `ApprovalChain` — logic over
in-memory entity graphs with no I/O).

What does **not** live here: anything that touches a database, network, or
framework. No `DbContext`, no `IdentityUser`, no `HttpContext`.

```
Domain/
├── Common/
│   ├── BaseEntity.cs            // Not used as a base class universally — entities
│   │                            // declare PKs directly; this exists for marker use.
│   ├── IAuditable.cs            // CreatedAt/UpdatedAt + CreatedByUserId/Name
│   └── ISoftDelete.cs           // IsArchived + ArchivedAt
├── Constants/
│   └── Roles.cs                 // Admin/Buyer/Approver/FinalApprover + Policies.FinalApproverOnly
├── Entities/                    // VendorRequest, ApprovalStep, VendorRevision
├── Enums/                       // VendorRequestStatus, ApprovalDecision
└── Services/
    └── ApprovalChain.cs         // GetPendingStepForUser, AdvanceWorkflow
```

**Entities implement marker interfaces** (`ISoftDelete`, `IAuditable`) so cross-cutting
concerns can target them without reflection.

**`ApplicationUser` is NOT in Domain.** It extends `IdentityUser` (an ASP.NET Identity
type) and lives in `Infrastructure/Identity/`. Domain entities that reference users
do so by string ID (`CreatedByUserId`), not by navigation property to ApplicationUser.

### `Application/` — CQRS use cases

What lives here: commands, queries, handlers, validators, DTOs, MediatR pipeline
behaviors, repository interfaces, service interfaces, AutoMapper profiles, the
`Result<T>` envelope, custom exception types, the EmailTemplates static helper.

```
Application/
├── Behaviors/                   // MediatR pipeline (Logging, Validation, Exception, WorkflowBroadcast)
├── Common/
│   ├── Exceptions/              // ApplicationException + NotFound/Forbidden/Conflict/BadRequest/Validation
│   ├── Mappings/                // AutoMapper profiles
│   └── Models/                  // Result<T>, PaginatedList<T>
├── DTOs/                        // Outbound shapes: VendorRequestDetailDto, UserDto, etc.
├── Features/
│   ├── Auth/Commands/           // LoginCommand, ForgotPasswordCommand, ResetPasswordCommand
│   ├── MasterData/Queries/      // GetMaterialGroupsQuery
│   ├── Users/{Commands,Queries}/
│   └── VendorRequests/
│       ├── Commands/            // One file per command (Create, Approve, Reject, …)
│       ├── Queries/             // One file per query (GetById, GetVendorRequests)
│       └── Common/              // Feature-internal helpers (TrackedFields, ApprovalChainBuilder, …)
├── Interfaces/                  // I-prefixed interfaces consumed by handlers
├── Services/
│   └── EmailTemplates.cs        // Pure (subject, body) factories — no I/O
└── DependencyInjection.cs       // AddApplication()
```

**No EF queries directly in handlers** beyond `db.X.AnyAsync(...)` style checks.
Repository interfaces (`IVendorRequestRepository`, `IGenericRepository<T>`) live
here; implementations live in Infrastructure. If a query is used in more than one
place, add it to a repository interface.

### `Infrastructure/` — concrete adapters

What lives here: `ApplicationDbContext` and its `IEntityTypeConfiguration<T>`
classes, EF migrations, repository implementations, `ApplicationUser` (Identity),
JWT token service, email service implementation, `DateTimeProvider`, DB seeding.

```
Infrastructure/
├── Authentication/
│   ├── JwtSettings.cs
│   └── JwtTokenService.cs
├── Identity/
│   ├── ApplicationUser.cs       // : IdentityUser
│   └── IdentityService.cs       // : IIdentityService
├── Persistence/
│   ├── ApplicationDbContext.cs  // : IdentityDbContext<ApplicationUser>, IApplicationDbContext
│   ├── Configurations/          // IEntityTypeConfiguration<T> per entity
│   ├── Migrations/              // dotnet ef migrations add ... output
│   ├── Repositories/            // GenericRepository<T>, VendorRequestRepository
│   └── Seed/
│       └── DbInitializer.cs     // Idempotent seeding of roles + admin user
├── Services/
│   ├── BrevoEmailService.cs     // : IEmailService — Brevo HTTP API
│   ├── DateTimeProvider.cs      // : IDateTimeProvider — UtcNow
│   └── EmailSettings.cs         // IOptions binding target
└── DependencyInjection.cs       // AddInfrastructure(config) — DbContext, Identity, JWT, services
```

### `API/` — HTTP edge

Thin controllers, middleware, SignalR hub, Program.cs. **No business logic.**

```
API/
├── Authorization/
│   └── FinalApproverRequirement.cs  // Role + email guard for Pardeep
├── Controllers/                     // ONE controller per resource; dispatch to MediatR
├── Hubs/
│   └── NotificationHub.cs           // /hubs/notifications
├── Middleware/                      // GlobalException, Csrf, SecurityHeaders
├── Services/
│   ├── CurrentUserService.cs        // : ICurrentUserService — reads HttpContext claims
│   └── SignalRNotificationService.cs // : INotificationService
└── Program.cs                       // builder.Services.AddApplication() + AddInfrastructure(config)
```

Controllers consist of:
1. Inbound model record (e.g. `CreateVendorRequestModel`) — separate from the command
   so the wire format is decoupled from internal types.
2. Authorization attribute (`[Authorize(Roles = ...)]` or `[Authorize(Policy = ...)]`).
3. Single body: build command/query, `await mediator.Send(...)`, wrap in `Result<T>.Ok(...)`,
   return.

---

## 3. Adding a new feature — copy-paste templates

A "feature" is a single command or query. Each gets its own file. **One handler per
file.** Two handlers in one file is allowed only when they query the same entity
and share validation (see `GetVendorRequestByIdQuery.cs`).

### 3.1 New Command

File: `src/Application/Features/<Feature>/Commands/<Name>Command.cs`

```csharp
using AndritzVendorPortal.Application.Common.Exceptions;
using AndritzVendorPortal.Application.DTOs;
using AndritzVendorPortal.Application.Interfaces;
using AndritzVendorPortal.Domain.Constants;
using AndritzVendorPortal.Domain.Entities;
using FluentValidation;
using MediatR;

namespace AndritzVendorPortal.Application.Features.<Feature>.Commands;

public record DoThingCommand(int Id, string Foo) : IRequest<SomeDto>;

public class DoThingCommandValidator : AbstractValidator<DoThingCommand>
{
    public DoThingCommandValidator()
    {
        RuleFor(x => x.Foo).NotEmpty().MaximumLength(200);
    }
}

public class DoThingCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService currentUser,
    IDateTimeProvider clock) : IRequestHandler<DoThingCommand, SomeDto>
{
    public async Task<SomeDto> Handle(DoThingCommand request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();

        var entity = await db.VendorRequests.FindAsync([request.Id], ct)
            ?? throw new NotFoundException(nameof(VendorRequest), request.Id);

        // … mutate …

        await db.SaveChangesAsync(ct);
        return Mapper.ToSomeDto(entity);
    }
}
```

Rules:
- **Command, Validator, Handler in the same file**, in that order.
- **Record types** for commands (`public record`).
- **Primary-constructor DI** for handlers (no separate constructor + readonly fields).
- **CancellationToken passed through** to every async DB call.
- **Throw typed exceptions** (`NotFoundException`, `ForbiddenException`,
  `ConflictException`, `BadRequestException`) — never return error status codes,
  the middleware maps them.

### 3.2 New Query

File: `src/Application/Features/<Feature>/Queries/<Name>Query.cs`

Same structure as a command but no validator (validation of query parameters is
typically unnecessary; if you need it, add one).

Queries **must not mutate state.** No `SaveChangesAsync` calls.

### 3.3 Wiring into a controller

File: `src/API/Controllers/<Resource>Controller.cs`

```csharp
public record DoThingModel(string Foo);

[HttpPost("{id:int}/do-thing")]
[Authorize(Roles = Roles.Buyer)]
public async Task<ActionResult<Result<SomeDto>>> DoThing(int id, [FromBody] DoThingModel m)
{
    var dto = await mediator.Send(new DoThingCommand(id, m.Foo));
    return Ok(Result<SomeDto>.Ok(dto));
}
```

Rules:
- **Separate request model from command.** The wire format and the internal command
  evolve at different speeds.
- **All success responses go through `Result<T>.Ok(...)`** so the frontend sees a
  consistent `{ success, message, errors, data }` envelope.
- **Authorization at the action level**, not the controller level, when permissions
  vary per endpoint.

### 3.4 New entity

1. Add the class to `src/Domain/Entities/`. Implement `IAuditable` and/or
   `ISoftDelete` if applicable. Reference users by string ID, not navigation.
2. Add `DbSet<X>` to `IApplicationDbContext` (Application layer) and
   `ApplicationDbContext` (Infrastructure).
3. Add `IEntityTypeConfiguration<X>` in
   `src/Infrastructure/Persistence/Configurations/`. Constraints, indexes, max
   lengths go here — not as attributes on the entity.
4. Generate a migration: `dotnet ef migrations add Add<X> --project src/Infrastructure --startup-project src/API`.

### 3.5 New cross-cutting service

If a handler needs to do something the abstractions don't cover (e.g. call a new
external API):

1. Add `IFooService` to `src/Application/Interfaces/`.
2. Implement it in `src/Infrastructure/Services/FooService.cs`.
3. Register: `services.AddScoped<IFooService, FooService>();` in
   `Infrastructure/DependencyInjection.cs`.
4. Inject `IFooService` into handlers via primary constructor.

---

## 4. MediatR pipeline (in order)

Defined in `Application/DependencyInjection.cs`. Every request flows through these,
in order:

| # | Behavior                       | Purpose                                                           |
|---|--------------------------------|-------------------------------------------------------------------|
| 1 | `UnhandledExceptionBehavior`   | Logs any unhandled exception, then rethrows.                      |
| 2 | `LoggingBehavior`              | Logs request name + handler duration.                             |
| 3 | `ValidationBehavior`           | Runs registered FluentValidation validators; throws ValidationException on failure. |
| 4 | `WorkflowBroadcastBehavior`    | After any **Command** returning `VendorRequestDetailDto`, pushes a SignalR `workflowChanged` event to buyer + approvers + admins. |

To add a new cross-cutting concern, write a `IPipelineBehavior<TRequest, TResponse>`
and register it in `AddApplication()`. Don't sprinkle the same logic across handlers.

---

## 5. Error handling

### Throw, don't return

Handlers signal failures by throwing **typed exceptions** from
`Application.Common.Exceptions`:

| Exception                | HTTP status | Use for                                              |
|--------------------------|-------------|------------------------------------------------------|
| `NotFoundException`      | 404         | Entity lookup miss.                                  |
| `ForbiddenException`     | 403         | User authenticated but lacks permission.             |
| `UnauthorizedException`  | 401         | Not authenticated.                                   |
| `ConflictException`      | 409         | Unique constraint, optimistic concurrency.           |
| `BadRequestException`    | 400         | Domain rule violation (with optional errors list).   |
| `ValidationException`    | 400         | Thrown by `ValidationBehavior`. Don't throw manually. |

`GlobalExceptionMiddleware` (in `API/Middleware/`) maps each to an HTTP status and
serializes the response through `Result.Fail(message, errors)`.

**Never** return `BadRequest(...)`, `NotFound(...)`, `Conflict(...)` from a handler.
**Never** catch a typed exception just to translate it — the middleware does that.

### Response envelope

Every successful response:

```json
{
  "success": true,
  "message": null,
  "errors": [],
  "data": { ... }
}
```

Every error response:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["VendorName: must not be empty"]
}
```

---

## 6. Persistence

- **EF Core 8** + **MySQL** (via `Pomelo.EntityFrameworkCore.MySql`). Connection
  string from `ConnectionStrings:DefaultConnection`. Server version is
  auto-detected at startup (override via `MySqlServerVersion`). On startup
  `DbInitializer.InitializeAsync` retries the connection up to 10× with 2s
  backoff, then runs `Database.MigrateAsync()` — Pomelo issues
  `CREATE DATABASE IF NOT EXISTS` implicitly, so a fresh dev box or server only
  needs MySQL running and valid credentials to come up clean.
- **Code-first migrations**. Never modify schema by hand.
  ```
  dotnet ef migrations add <Name> --project src/Infrastructure --startup-project src/API
  dotnet ef database update          --project src/Infrastructure --startup-project src/API
  ```
- **`IEntityTypeConfiguration<T>` per entity** — not data annotations on entities.
- **Repositories for non-trivial queries.** A query that's used in more than one
  handler must move to a repository method. Inline `db.X.Where(...).ToListAsync()`
  in handlers is fine for one-offs.
- **No raw SQL** except in migrations. If you find yourself reaching for
  `ExecuteSqlRaw`, ask whether the model should change first.
- **`SaveChangesAsync(ct)` exactly once per command.** Don't save mid-handler.
- **Identity tables** (`AspNetUsers`, etc.) are managed by ASP.NET Identity — go
  through `UserManager<ApplicationUser>` via `IIdentityService`, not direct EF
  queries.

---

## 7. Authentication & Authorization

- **JWT bearer** for HTTP; same token via `?access_token=` query string for SignalR
  WebSocket handshake (configured in `Infrastructure/DependencyInjection.cs`).
- **ASP.NET Core Identity** stores users + roles. `ApplicationUser` extends
  `IdentityUser` with `FullName`, `Designation`, `IsArchived`.
- **4 roles** (constants in `Domain/Constants/Roles.cs`):
  - `Admin` — manages users and views all requests.
  - `Buyer` — creates and resubmits requests.
  - `Approver` — intermediate approval/rejection.
  - `FinalApprover` — final approval + vendor code entry. **Pardeep Sharma only**
    (enforced by `FinalApproverRequirement` policy in `API/Authorization/` —
    role check + email guard).
- **Authorize at the action**, not the controller, when endpoints in the same
  controller need different roles. Use `[Authorize(Roles = $"{Roles.X},{Roles.Y}")]`
  for OR. Use `[Authorize(Policy = Policies.FinalApproverOnly)]` for the
  `/complete` endpoint.
- **CSRF**: `CsrfMiddleware` enforces double-submit cookie for state-changing
  requests on authenticated routes (except `/api/auth/*`).

---

## 8. Real-time notifications (SignalR)

- Hub: `/hubs/notifications` (declared in `API/Hubs/NotificationHub.cs`,
  mapped in `Program.cs`).
- Frontend connects with JWT via query string. Admins auto-join group `"admins"`
  on connect.
- The only event currently published is `workflowChanged` with payload `{ id }`.
  Clients use it as a hint to refetch.
- **Backend pushes are automatic.** Any MediatR command that returns
  `VendorRequestDetailDto` triggers `WorkflowBroadcastBehavior`, which broadcasts
  to `{ buyer, all approvers in the chain, admins group }`. Don't add SignalR
  calls inside individual handlers.

---

## 9. Email

- **Provider**: Brevo HTTP API (`BrevoEmailService`). No SMTP.
- **`EmailTemplates`** (in `Application/Services/`) is a pure static class returning
  `(string Subject, string Body)` tuples. Add a new template by adding a method.
- **`IEmailService`** has a single `SendAsync(to, subject, body, ...)` method.
  Failures are logged and swallowed — emails never fail a request.
- Handlers should call `EmailTemplates.X(...)` to build content and `IEmailService`
  to send. **Don't** put HTML literals in handlers.

---

## 10. Logging

- **Serilog**, wired in `Program.cs`. Console + rolling file
  (`logs/log-yyyy-MM-dd.txt`, 14-day retention).
- **Use `ILogger<T>` via constructor injection.** Don't call `Log.X` statically.
- **Use structured logging**: `logger.LogInformation("User {UserId} did {Action}", ...)`,
  not `$"User {userId} did {action}"`.

---

## 11. Testing

- **Project**: `AndritzVendorPortal.Tests` (xUnit). References `Domain` and
  `Application` only.
- **Existing coverage**: `ApprovalChainTests` against the pure domain service.
- **Add tests for** new pure-domain logic, command/query handlers (mock interfaces),
  validators. Don't write tests that boot the full WebApplication unless you're
  testing integration with a real DB.
- **Run**: `dotnet test`.

---

## 12. Configuration

`src/API/appsettings.json` + environment variables (env wins). Required keys:

| Key                           | Purpose                                           |
|-------------------------------|---------------------------------------------------|
| `ConnectionStrings:DefaultConnection` | MySQL connection string (e.g. `Server=localhost;Port=3306;Database=AndritzVendorPortal;User=root;Password=root`). |
| `Jwt:Key`                     | Symmetric signing key (≥ 32 chars).               |
| `Jwt:Issuer`, `Jwt:Audience`  | Token validation parameters.                      |
| `EmailSettings:BrevoApiKey`   | Brevo API key.                                    |
| `EmailSettings:FromEmail`     | Sender email.                                     |
| `EmailSettings:FromName`      | Sender display name.                              |
| `AllowedOrigins`              | String array of allowed CORS origins.             |
| `PortalUrl`                   | Used in email links.                              |
| `Seed:DefaultAdminPassword`   | Initial admin password on first run.              |

---

## 13. What NOT to do

- **Don't put EF queries in controllers.** Controllers dispatch to MediatR. Period.
- **Don't reference `Infrastructure` from `Application`.** If a handler needs it,
  the interface goes in `Application/Interfaces/`.
- **Don't reference `ApplicationDbContext` from handlers.** Use
  `IApplicationDbContext` so the handler stays testable.
- **Don't add data annotations to entities** (`[Required]`, `[MaxLength]`, etc.).
  Put constraints in `IEntityTypeConfiguration<T>`.
- **Don't return `IActionResult` from a controller without wrapping in `Result<T>`.**
- **Don't catch `Exception` in handlers** to swallow it. Let it bubble to the
  middleware.
- **Don't add a new top-level folder under a project** without updating this doc.
- **Don't introduce a new abstraction layer** (services-of-services, manager
  classes, etc.) without a concrete reason.
- **Don't write business logic in the API layer.** The API layer translates HTTP
  to MediatR and back. Anything else is misplaced.

---

## 14. When this doc is wrong

Update it. Don't work around it. A pattern that doesn't match this doc is either
a bug or a missing entry.
