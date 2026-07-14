# Secrets: rotation runbook

Four live secrets were committed to `src/API/appsettings.json` in plaintext. They have been removed
from the file, but **removing them from the file does not remove them from git history** — anyone
with repo access (now, or from any past clone, fork, or CI artifact) can still read them.

**Every one of them must be treated as compromised and rotated.** Until that is done, the fix is
cosmetic.

The old values are deliberately **not reproduced here** — this file is committed too, and copying
them into it would just move the leak. Read each one out of git history if you need it
(`git show 174955e:src/API/appsettings.json`), rotate it, and do not paste it anywhere else.

| Secret | Config key | Rotate by |
| --- | --- | --- |
| SMTP relay password | `EmailSettings:Password` | Ask IT to reset the password for the `SCMVendoApprovalNotification` mailbox |
| Seed admin password | `Seed:DefaultAdminPassword` | Choose a new one. Also change the existing admin account's password *in the portal* — the seeded value is a live login, not just a bootstrap default |
| JWT signing key | `JwtSettings:SecretKey` | Generate a new 32+ char key (below). This invalidates every issued token — all users are signed out once, which is the intended effect |
| SQL login | `ConnectionStrings:DefaultConnection` (connects as **`sa`**) | Create the least-privilege `sot_app` login (below) and change the `sa` password |
| Live user account passwords | were listed in `Updated_BRD.md` §10 | Reset each account's password in the portal (FinalApprover, Buyer, Approver, Admin) |

The JWT key is the most urgent of the four: anyone holding it can mint a token for any user, in any
role, including the Final Approver.

## Where the secrets live now

Nothing is read from a committed file any more. The app takes each secret from an environment
variable and **refuses to boot** if one is missing, rather than falling back to a default:

```
ConnectionStrings__DefaultConnection
JwtSettings__SecretKey
EmailSettings__Password
Seed__DefaultAdminPassword
```

(`__` is the ASP.NET Core separator for nested config keys.)

### Production (IIS, `D:\Production2024\SOT`)

Set them per-app-pool so they are not readable from other sites on the box. In an elevated
PowerShell:

```powershell
Import-Module WebAdministration

$app = "IIS:\Sites\Default Web Site\SOT"   # adjust to the actual app path

Set-WebConfigurationProperty -PSPath $app -Filter "system.webServer/aspNetCore/environmentVariables" `
  -Name "." -Value @{ name="ConnectionStrings__DefaultConnection"; value="Server=QNFSMS025\SQLEXPRESS;Database=SOT;User Id=sot_app;Password=<new-password>;TrustServerCertificate=True;MultipleActiveResultSets=true" }

Set-WebConfigurationProperty -PSPath $app -Filter "system.webServer/aspNetCore/environmentVariables" `
  -Name "." -Value @{ name="JwtSettings__SecretKey"; value="<new-32-char-key>" }

Set-WebConfigurationProperty -PSPath $app -Filter "system.webServer/aspNetCore/environmentVariables" `
  -Name "." -Value @{ name="EmailSettings__Password"; value="<new-smtp-password>" }

Set-WebConfigurationProperty -PSPath $app -Filter "system.webServer/aspNetCore/environmentVariables" `
  -Name "." -Value @{ name="Seed__DefaultAdminPassword"; value="<new-admin-password>" }
```

Then `iisreset` (or recycle the app pool) and confirm the app starts — a missing secret now fails
the boot loudly instead of running on a weak default.

`EmailSettings__Password` is checked as a *pair* with `EmailSettings:Username`, not on its own: a
relay that accepts anonymous internal mail is a legitimate setup (no username, no password), but a
username with a blank password is not. It would authenticate as `(username, "")` on every send —
the app boots perfectly healthy, then fails auth on every message, burns its retries over ~45
minutes of backoff, and abandons every notification, visible only in the logs. Since the username
is committed to `appsettings.json` and the password comes from the environment, that is exactly the
shape a forgotten `EmailSettings__Password` would take, so the boot refuses it.

Generate a signing key:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

### Local development

`appsettings.Development.json` carries local-only values (a localhost DB, MailHog, a placeholder
signing key). None of them are production credentials. For anything real, use user-secrets:

```bash
dotnet user-secrets --project src/API set "JwtSettings:SecretKey" "<key>"
```

## Least-privilege SQL login

The app currently connects as `sa` — full sysadmin over the whole instance. It needs only DML on its
own database, plus DDL for the EF migrations it runs at boot. Run
[`scripts/create-sot-sql-login.sql`](scripts/create-sot-sql-login.sql) to create `sot_app` with
exactly that, point `ConnectionStrings__DefaultConnection` at it, and then change the `sa` password
(it is in git history too).

## Scrubbing git history

Rotation is what actually protects you, and it is enough. If the history must also be scrubbed —
worth doing, but do not treat it as a substitute for rotating —
[`git-filter-repo`](https://github.com/newren/git-filter-repo) is the tool, and it rewrites every
commit hash, so it needs coordinating with everyone holding a clone.
