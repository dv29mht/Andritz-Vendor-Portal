# SOT Portal — Database migration steps (for this release)

This release adds **5 database changes** on top of what is currently on the
`SOT` database. They are applied automatically on first boot, **or** you can run
the supplied SQL script manually before deploying (recommended if the IIS
app‑pool's SQL login is not allowed to create/alter tables).

**What this release adds**

| Change | Object |
|--------|--------|
| New table | `Notifications` (+ index) |
| New column | `VendorRequests.Email` |
| New column | `VendorRevisions.RejectedByName` |
| New table | `OutboxEmails` (+ filtered index) — the email queue |
| New column | `VendorRequests.RowVersion` (`rowversion`) — optimistic concurrency |

**No data repair is needed.** The production data is clean (0 duplicate approval steps, 0 orphans,
0 half-applied decisions); the unique index rejected the bad insert atomically and the transaction
rolled back. These two additions exist to stop the *code* re-creating the problem, not to fix rows.

`RowVersion` is a SQL Server `rowversion` column: SQL Server populates it for every existing row
automatically as part of the `ALTER TABLE`, so there is nothing to backfill. On a large
`VendorRequests` table the ALTER does rewrite the table, so run it in the deployment window.

`OutboxEmails` starts empty. Rows appear as soon as the app queues its first notification, and the
background dispatcher deletes nothing — sent mail is retained as an audit trail. Watch it after
go-live:

```sql
-- Anything stuck? Non-zero rows here means the relay is not accepting mail.
SELECT Id, ToEmail, Subject, AttemptCount, NextAttemptAt, IsAbandoned, LastError
FROM OutboxEmails
WHERE SentAt IS NULL
ORDER BY Id;
```

A row with `IsAbandoned = 1` is mail we gave up on after 6 attempts; `LastError` says why. That is
now a visible, queryable failure instead of a silently swallowed exception.

The script is **idempotent**: it checks `__EFMigrationsHistory` and only applies
what is missing. Running it more than once is safe and does nothing the second time.

---

## Option A — Let the app migrate on first boot (default, no manual step)

On startup the app runs the migrations itself, then starts serving.

**Requirement:** the identity the IIS app pool uses to connect to SQL Server
(Windows auth per `appsettings.json`, `Trusted_Connection=True`) **must be able
to CREATE/ALTER tables** on the `SOT` database — i.e. it needs `db_owner` (or at
minimum `db_ddladmin` + `db_datawriter` + `db_datareader`).

If that login is read/write only, startup will fail with a permissions error and
the site will not come up. In that case use **Option B**.

> The app waits up to ~5 minutes for SQL on cold start (`web.config`
> `startupTimeLimit=300`), so a slow first boot is normal, not a failure.

---

## Option B — Run the migration script manually before deploy (recommended)

A DBA (or anyone with `db_owner` on `SOT`) runs the supplied script once. After
that the app finds nothing pending on boot and starts normally even with a
least‑privilege app‑pool login.

**File:** `Migrate_SOT_idempotent.sql` (in this bundle / sent alongside it)

### Using SQL Server Management Studio (SSMS)
1. **Back up the `SOT` database first** (right‑click `SOT` → Tasks → Back Up…).
2. Connect to the SQL Server that hosts `SOT`.
3. **File → Open → File…** and open `Migrate_SOT_idempotent.sql`.
4. In the database dropdown on the toolbar, **select `SOT`** (important — the
   script has no `USE` statement; it runs against whatever database is selected).
5. Click **Execute** (F5). It should complete with no errors.

### Using sqlcmd (command line)
```cmd
sqlcmd -S <SERVER_NAME> -d SOT -E -b -i Migrate_SOT_idempotent.sql
```
- `-S <SERVER_NAME>` e.g. `mansms012` or `QNFSMS025\SQLEXPRESS`
- `-d SOT` runs it against the SOT database
- `-E` uses Windows authentication (or use `-U <user> -P <password>` for SQL auth)
- `-b` stops on the first error so nothing is half‑applied

---

## Verify it worked (either option)

Run this against `SOT` — you should see **6 rows**, ending in
`20260714104202_AddEmailOutboxAndVendorRequestRowVersion`:

```sql
SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;
```

Expected:
```
20260521020742_InitialCreate
20260521034839_AddLoginSecurity
20260603072902_AddNotifications
20260619060756_AddVendorEmail
20260624090245_AddRejectedByNameToRevision
20260714104202_AddEmailOutboxAndVendorRequestRowVersion
```

Quick column/table check:
```sql
SELECT COL_LENGTH('VendorRequests','Email')            AS Email_added,        -- non-NULL = present
       COL_LENGTH('VendorRevisions','RejectedByName')  AS RejectedByName_added,
       COL_LENGTH('VendorRequests','RowVersion')       AS RowVersion_added,
       OBJECT_ID('Notifications')                      AS Notifications_table,
       OBJECT_ID('OutboxEmails')                       AS OutboxEmails_table;  -- non-NULL = present
```

---

## Notes & rollback
- These changes are **additive** — no existing column or table is dropped or
  altered destructively, so existing data is untouched.
- If you need to back out the whole release, restore the pre‑deploy backup you
  took in step 1. (There is no automatic "down" script; restoring the backup is
  the supported rollback.)
- This was validated against a restore of the current `SOT` backup
  (`SOT-23062026.bak`): the migration applied cleanly and the app booted with no
  errors.
