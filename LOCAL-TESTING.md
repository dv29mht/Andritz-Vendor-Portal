# SOT Portal — Local Testing

Run the full portal (React SPA + .NET API) locally in Docker, against a SQL
Server you host yourself and manage in **SSMS**. Outbound email is captured by
MailHog so you can read every notification without sending real mail.

Mirrors the office deployment shape: single origin, `/SOT` sub-path, code-first
migrations on boot.

## Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2) running.
- **SQL Server** on your machine (Express/Developer is fine), configured once:
  - **TCP/IP enabled**, listening on port **1433** (SQL Server Configuration
    Manager → Network Configuration → Protocols → TCP/IP → Enable → restart the
    service). A Linux container cannot reach a named pipe / shared memory instance.
  - **Mixed Mode (SQL Server Authentication) enabled** — the container logs in
    with a SQL login, not Windows auth. (SSMS → server Properties → Security →
    "SQL Server and Windows Authentication mode" → restart the service.)
  - A SQL login with permission to **create the `SOT` database** on first boot
    (`sa`, or any login with `dbcreator`/`sysadmin`). Alternatively pre-create an
    empty `SOT` database in SSMS and grant the login `db_owner` on it.

## Configure the DB connection

The defaults assume login `sa` / password `LocalDev@1234` against
`host.docker.internal,1433`, database `SOT`. To use your own credentials, copy
`.env.example` to `.env` (next to `docker-compose.yml`) and edit the values —
no need to touch `docker-compose.yml`:

```
DB_HOST=host.docker.internal
DB_PORT=1433
DB_NAME=SOT
DB_USER=sa
DB_PASSWORD=YourStrong@Passw0rd
```

> `host.docker.internal` is how the container addresses your host machine. On
> Docker Desktop it works out of the box; the `extra_hosts` entry in the compose
> file makes it work on Linux Docker engines too.

## Run

```bash
docker compose up --build
```

First run takes a few minutes (builds the .NET + React bundle). Watch the `api`
logs for the seed confirmation line:

```
[Seed] Repaired pardeep.sharma@andritz.com: ... passwordCheck=OK
```

Then open:

- **App:**  http://localhost:8080/SOT
- **MailHog inbox:**  http://localhost:8025

If the API can't reach SQL Server you'll see connection retries in the `api`
logs for ~2 minutes before it gives up — recheck TCP/IP, mixed-mode auth, the
firewall on port 1433, and the credentials in `.env`.

## Log in

| Field | Value |
|---|---|
| Email | `pardeep.sharma@andritz.com` |
| Password | `LocalDev@1234` |

This single elevated account does everything — the global dashboard, All
Requests, User Management, Email Templates, the final-approval queue, Permanent
and One-Time vendors.

## Suggested smoke test

1. Log in as the elevated account → confirm the merged sidebar shows both admin
   and final-approver items, and that **Sign out** is in the top header.
2. **User Management** → create a Buyer and an Approver. Check MailHog for their
   invitation emails.
3. Log in as the Buyer (use the seeded password) → submit a vendor request,
   selecting the Approver in the chain.
4. Log in as the Approver → approve it.
5. Back as the elevated account → **Pending Queue** → Final Review → enter a SAP
   vendor code → confirm it completes and the buyer-facing email lands in MailHog.

## Inspect the database in SSMS

Connect SSMS directly to your host instance (e.g. `localhost` or
`.\SQLEXPRESS`), database `SOT` — it's the same database the container writes to.

## Lifecycle

```bash
# Stop the containers (your host SQL data is untouched)
docker compose down

# Rebuild after a code change
docker compose up --build
```

To reset to a clean database, drop the `SOT` database in SSMS — it is recreated
and re-seeded on the next `docker compose up`.

## Ports

| Service | Host port | Purpose |
|---|---|---|
| api | 8080 | Portal (SPA + API) at `/SOT` |
| mailhog | 8025 | Email inbox UI |
| mailhog | 1025 | SMTP (internal target for the app) |
| (your host) | 1433 | SQL Server — managed in SSMS, reached as `host.docker.internal` |
