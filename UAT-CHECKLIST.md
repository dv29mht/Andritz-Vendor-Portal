# Andritz Supplier Connect — UAT Checklist

End-to-end acceptance test for the 13 reported points, to run against the local
Docker stack. Each item lists its **status**, **how to test**, and the
**expected result**.

> **Legend**
> - ✅ **Already in code** — was fixed in a prior commit; if your last Docker run
>   showed it broken, you were testing a **stale image**. A fresh rebuild resolves it.
> - 🆕 **Fixed in this round** — new code change made for this UAT.

---

## 0. Prerequisites & how to run

The stack runs the API + bundled React SPA in Docker, talking to a **SQL Server
you run on the host** (managed in SSMS / Azure Data Studio), with **MailHog**
capturing every outbound email.

1. **Docker Desktop** running.
2. **Host SQL Server** reachable on `localhost:1433`, SQL auth enabled, login
   `sa` / `Andritz@1234` (or override via a `.env` — see `.env.example`).
   The container creates the `SOT` database + schema and applies migrations on boot.
   - ⚠️ If 1433 is not listening, the container **exits on startup by design**
     (fail-fast) — start SQL Server first.
3. Rebuild fresh and start:
   ```bash
   docker compose build --no-cache
   docker compose up -d
   docker compose logs -f api      # watch for "[Boot] Database migration + seed complete"
   ```
4. Open the app:  **http://localhost:8080/SOT**
   Login (Final Approver / admin):  `pardeep.sharma@andritz.com` / `Andritz@1234`
5. Email inbox (all notifications):  **http://localhost:8025**  (MailHog)

---

## 1. Currency — NPR + all world currencies ✅
- **Test:** New Vendor → *Commercial Terms* → **Currency** dropdown.
- **Expected:** Full ISO‑4217 list (~160 currencies). **NPR (Nepalese Rupee)** is present,
  alongside INR, USD, EUR, etc.

## 2. PAN — validation removed ✅
- **Test:** *Tax Identification* → **PAN Card**. Enter any format (e.g. `ABC123`, `12-XY-99`).
- **Expected:** No format/regex error. PAN is **free‑text and optional** (hint: "Optional — any format").
  Other countries' formats are accepted.

## 3. IFSC Code — optional ✅
- **Test:** Turn the *Financial / Bank Details* section **On**, fill bank name/account,
  leave **IFSC / Bank Code** blank, submit.
- **Expected:** Submits successfully. IFSC is optional (hint: "Optional — not every country uses IFSC").

## 4. Purchasing Doc — D = Domestic, E = Export 🆕
- **Test:** *Purchasing Scope* → **Purchasing Organization**. Select a `…D` code
  (900D / T20D), then a `…I` code (900I / T20I).
- **Expected:**
  - `…D` → green **"Domestic vendor"** badge.
  - `…I` → amber **"Export vendor"** badge, with "— GST may be entered as N/A".
  - Field hint reads **"Suffix D = Domestic vendor · I = Export vendor"**.
  - (Codes are unchanged; only the Import → **Export** wording changed, per your decision.)

## 5. Financial / Bank & Taxation — On/Off toggles ✅
- **Test:** Each section header has an **On/Off** switch. Toggle *Financial / Bank Details*
  and *Tax Identification* off, then on.
- **Expected:** Off → fields hidden and **excluded from validation** (left blank for that vendor).
  On → fields shown and validated.

## 6. Password change persists (no revert to default) ✅
- **Test:**
  1. Trigger a reset for a user (Login → *Forgot password*), open the reset link from **MailHog**, set a new password.
  2. Log in with the **new** password.
  3. Restart the API: `docker compose restart api`.
  4. Log in again with the **new** password.
- **Expected:** The new password keeps working after restart; the old/seed password no longer works.
  (The seeder only sets a password when an account has **none** — it never overwrites a user-changed password.)

## 7. Andritz logo visible in Production 🆕
- **Test:** With the app served under the `/SOT` sub‑path, view the **login screen**,
  the **left sidebar**, and the **top header**.
- **Expected:** The Andritz logo renders in all three (no broken-image icon).
  - Root cause was a base‑path mismatch: a bare `dotnet publish` built the SPA for `/`
    while it is served under `/SOT`. The build now **defaults the SPA base to `/SOT/`**
    (override with `-p:ViteBasePath=/` for root hosting); Docker already passed `/SOT/`.

## 8. Export / foreign vendor GST = "N/A" (no 15‑char rule) ✅
- **Test:** Pick an Export purchasing org (e.g. 900I). In **GST Number** enter `N/A`.
- **Expected:** Accepted — no "must be 15 characters" error. Hint reads
  "Enter N/A for export / foreign vendors with no GST".

## 9. Email ID field — present **and saved** 🆕
- **Test:** *Contact* → **Email ID** (e.g. `accounts@vendor.com`). Submit the request,
  then reopen it from the Vendor detail view. Also try editing/resubmitting.
- **Expected:** Email is captured, **persisted to the database**, and shown in the detail view
  / printed form. Invalid emails are rejected; blank is allowed (optional field).
  - Previously the field existed in the UI but the backend silently dropped it — now wired
    end‑to‑end (entity + commands + DTO + migration `AddVendorEmail`).

## 10. Approver / user can preview attached documents ✅
- **Test:** As an Approver (or Admin), open a request → **Documents** section → click **Preview**.
- **Expected:** PDFs/images open in a new tab; other types download. Works for buyer, approver, and admin.

## 11. Document attachment — drag‑and‑drop + multiple files ✅
- **Test:** On any document field, **drag files** onto the drop zone (border highlights),
  and use the picker to select **multiple files at once**.
- **Expected:** Files are added (and accumulate across multiple adds). 5 MB per‑file limit is
  enforced with a toast. Each attached file shows a Preview/remove control.

## 12. Form‑submit notification — approver only ✅ (your decision: "send to approver only")
- **Test:** As a Buyer, submit a request that has an intermediate approver. Check **MailHog**.
- **Expected:** Email goes **only to the assigned approver** who must act. **No** buyer
  confirmation and **no** admin copy on submit.

## 13. Pending‑approval — Admin no longer emailed 🆕 (your decision)
- **Test:** Approve a request through to the final stage. Check **MailHog**.
- **Expected:** The **Final Approver (admin) receives NO "pending your approval" email** — they
  act from the in‑app notification bell / console. (Oversight CC copies on **reject**,
  **completion**, and **resubmit** are still sent, as you chose to keep those.)

---

## Summary of code changes made this round
| # | Item | Change |
|---|------|--------|
| 4 | Purchasing Doc D/E | Relabeled "Import" → "Export" in the form (badge, hint, GST messages). Codes unchanged. |
| 7 | Logo in production | `BuildFrontend` now sets the SPA base path (defaults to `/SOT/`) so `dotnet publish` SPAs resolve assets. |
| 9 | Email ID | Wired `Email` through entity, all vendor commands, controller models, DTO, mapper, revision diff, detail/print views; EF migration `AddVendorEmail`. |
| 13 | Admin pending email | Removed the Final‑Approver "pending your approval" email from the Submit and Approve flows. |

Items 1, 2, 3, 5, 6, 8, 10, 11, 12 were **already correct in source** — verify them
on the freshly rebuilt image.
