# Andritz Vendor Registration Portal — Updated BRD

## 1. Overview
Digitize vendor registration, route through multi-level approval, generate SAP vendor code, produce PDF, and notify via email.

---

## 2. Objectives

- Digitize the vendor registration process
- Provide a structured multi-level approval workflow
- Maintain transparency and audit trail of vendor information
- Enable revision tracking for vendor detail changes
- Generate a downloadable vendor registration PDF document
- Automatically notify users via email at every workflow step

---

## 3. Roles

| Role | Key Responsibilities |
|---|---|
| **Admin** | Create/assign users (Buyer, Approver), view all requests + statuses, edit user emails, download PDFs |
| **Buyer** | Create vendor requests, select approvers, resubmit on rejection, receive vendor code, update completed records |
| **Approver** | Review requests, approve or reject with comments |
| **FinalApprover** | Pardeep Sharma only (`pardeep.sharma@yopmail.com`) — final approval, enter SAP vendor code, complete submission |

---

## 4. Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | Buyer | Create request, fill vendor form, select approver(s), submit or save as Draft |
| 2 | Approver | Approve → moves to next step or PendingFinalApproval; or Reject with comment |
| 3 | Buyer (on rejection) | Update details, resubmit → RevisionNo++ |
| 4 | FinalApprover | Final approval + enter SAP vendor code → status = Completed |
| 5 | System | Email notifications fired at every step (see §8) |

**Status flow:** `Draft → PendingApproval → PendingFinalApproval → Completed`
Rejection at any step → Buyer edits → resubmit (field-level diff tracked)

---

## 5. Vendor Form Fields
Vendor Name, GST Number, PAN Card, Contact Person, Telephone, Address Details, City (dropdown), Locality (dropdown), Postal Code, State, Country, Material Group, Currency, Payment Terms, Incoterms, Reason, Yearly PVO, Proposed By, One-Time Vendor flag.

---

## 6. Revision Management
On each rejection+resubmission: new revision version created, tracking modified fields (field-level diff), who changed them, and revision number (REV 1, REV 2, …). Admin edits on Completed records also tracked.

---

## 7. Features — Implemented ✅

- [x] Vendor registration form with all fields + dropdown master data
- [x] Save as Draft + submit separately
- [x] Multi-level approval workflow (unlimited intermediate approvers)
- [x] Rejection + resubmission with revision control + field-level diff
- [x] SAP vendor code entry (FinalApprover only, email-gated)
- [x] Approval history + full audit trail
- [x] Admin user management (create, edit email/name/role/password, archive/restore)
- [x] Buyer can update completed vendor records (tracked in revision history)
- [x] One-time vendor vs permanent vendor classification
- [x] Excel import for bulk vendor data pre-fill
- [x] Forgot password / reset password via email link
- [x] Role-based consoles (Buyer, Approver, FinalApprover, Admin)
- [x] JWT authentication + CSRF protection + rate limiting
- [x] Deployed: backend on Render (PostgreSQL), frontend on Vercel

---

## 8. Email Notifications — Implemented ✅

All emails sent via Brevo API (no domain restriction on recipients).

| Trigger | Recipients |
|---|---|
| New user created | New user (welcome email with portal link) |
| Request submitted / resubmitted | Buyer (confirmation) + First approver (action required) + Admin |
| Approval step completed | Buyer + Approver who acted + Next approver + Admin |
| All intermediate steps done | Buyer + FinalApprover + Admin |
| Request rejected | Buyer + Admin |
| SAP code assigned (Completed) | Buyer + Admin |
| Buyer updates completed record | FinalApprover + Admin (with field diff) |
| Forgot password | User (reset link, expires 1 hour) |

---

## 9. Pending / Future

- [ ] PDF generation — downloadable vendor registration PDF with approval records
- [ ] Azure AD sync — import users from Active Directory (placeholder endpoint exists at `POST /api/users/sync-ad`)
- [ ] Change password from within the portal (Settings page)

---

## 10. Accounts (Live DB)

| Email | Password | Role |
|---|---|---|
| `pardeep.sharma@yopmail.com` | `Dahlia@1234` | FinalApprover |
| `vikram.nair@andritz.com` | `Dahlia@1234` | Buyer |
| `rajesh.kumar@andritz.com` | `Dahlia@1234` | Approver |
| `adminandritz@yopmail.com` | `Dahlia@1234` | Admin |

---

## 11. Infrastructure

| Component | Detail |
|---|---|
| Frontend | React 18 + Vite, deployed on Vercel |
| Backend | .NET 8 Web API, deployed on Render (free tier) |
| Database | PostgreSQL on Render |
| Email | Brevo API (`xkeysib-...`) — 300 emails/day free |
| Auth | ASP.NET Core Identity + JWT Bearer |
