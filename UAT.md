# SOT Portal — UAT Environment

A self-contained Docker replica of the client's production (`/SOT`) environment, for
running User Acceptance Testing off-server before deploying to `QNFSMS025`.

## What it mirrors

| Aspect | Production (client) | UAT replica |
|---|---|---|
| Hosting path | IIS sub-app at `/SOT` | `/SOT` (`App__PathBase`, SPA built for `/SOT/`) |
| Database | SQL Server `SOT` on `QNFSMS025\SQLEXPRESS` | SQL Server `SOT` in the `mssql` container |
| Schema | Code-first migrations on boot | Code-first migrations on boot (same code) |
| Elevated account | `pardeep.sharma@andritz.com` (Final Approver, all admin powers) | Same, seeded automatically |
| Front end + API | Single origin | Single origin (one container) |

**Documented deltas** (only what a Linux container can't reproduce):
- SQL authentication (`sa`) instead of Windows `Trusted_Connection`.
- Outbound email is captured by **MailHog** instead of the `mail.andritz.com` relay —
  so testers can read every notification without sending real mail.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2) running.

## Run

```bash
docker compose -f docker-compose.uat.yml up --build
```

First run takes a few minutes (pulls the SQL Server image, builds the .NET + React
bundle). Watch the `api` logs for the seed confirmation line:

```
[Seed] Repaired pardeep.sharma@andritz.com: ... passwordCheck=OK
```

Then open:

- **App:**  http://localhost:8080/SOT
- **MailHog inbox:**  http://localhost:8025

## Log in

| Field | Value |
|---|---|
| Email | `pardeep.sharma@andritz.com` |
| Password | `Andritz@1234` |

This single elevated account now does everything — the global dashboard, All Requests,
User Management, Email Templates, the final-approval queue, Permanent and One-Time
vendors. (The former separate `admin@andritz.com` login no longer exists; if a legacy
one is present in a restored database it is archived on boot.)

## Suggested UAT smoke test

1. Log in as the elevated account → confirm the merged sidebar shows both admin and
   final-approver items, and that **Sign out** is in the top header (not the sidebar).
2. **User Management** → create a Buyer and an Approver (the role dropdown offers only
   Buyer / Approver). Check MailHog for their invitation emails.
3. Log in as the Buyer (use the seeded password) → submit a vendor request, selecting
   the Approver in the chain.
4. Log in as the Approver → approve it.
5. Back as the elevated account → **Pending Queue** → Final Review → enter a SAP vendor
   code → confirm it completes and the buyer-facing email appears in MailHog.

## Lifecycle

```bash
# Stop (keeps the SOT database in the named volume)
docker compose -f docker-compose.uat.yml down

# Reset to a clean database (re-seeds on next up)
docker compose -f docker-compose.uat.yml down -v

# Rebuild after a code change
docker compose -f docker-compose.uat.yml up --build
```

## Ports

| Service | Host port | Purpose |
|---|---|---|
| api | 8080 | Portal (SPA + API) at `/SOT` |
| mailhog | 8025 | Email inbox UI |
| mailhog | 1025 | SMTP (internal target for the app) |
| mssql | 11433 | SQL Server (host-side, for ad-hoc inspection with SSMS/Azure Data Studio) |

> Connection for ad-hoc DB inspection: `localhost,11433`, user `sa`, password
> `Uat#SqlServer2024!`, database `SOT`, "Trust server certificate" enabled.
> These are throwaway UAT credentials — do not reuse them in production.
