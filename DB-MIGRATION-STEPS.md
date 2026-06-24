# SOT Portal — Database migration steps (for this release)

This release adds **3 database changes** on top of what is currently on the
`SOT` database. They are applied automatically on first boot, **or** you can run
the supplied SQL script manually before deploying (recommended if the IIS
app‑pool's SQL login is not allowed to create/alter tables).

**What this release adds**

| Change | Object |
|--------|--------|
| New table | `Notifications` (+ index) |
| New column | `VendorRequests.Email` |
| New column | `VendorRevisions.RejectedByName` |

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

Run this against `SOT` — you should see **5 rows**, ending in
`20260624090245_AddRejectedByNameToRevision`:

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
```

Quick column/table check:
```sql
SELECT COL_LENGTH('VendorRequests','Email')        AS Email_added,        -- non-NULL = present
       COL_LENGTH('VendorRevisions','RejectedByName') AS RejectedByName_added,
       OBJECT_ID('Notifications')                  AS Notifications_table; -- non-NULL = present
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
