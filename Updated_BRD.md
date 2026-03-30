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
- Automatically notify users via email after vendor approval

---

## 3. Roles

| Role | Key Responsibilities |
|---|---|
| **Admin** | Create/assign users (Buyer, Approver), view all requests + statuses, download PDFs |
| **Buyer** | Create vendor requests, select approvers, resubmit on rejection, receive vendor code |
| **Approver** | Review requests, approve or reject with comments |
| **FinalApprover** | Pardeep Sharma only — final approval, enter SAP vendor code, complete submission |

---

## 4. Workflow

| Step | Actor | Action |
|---|---|---|
| 1 | Buyer | Create request, fill vendor form, select approver(s) |
| 2 | Approver | Approve → moves to PendingFinalApproval; or Reject with comment |
| 3 | Buyer (on rejection) | Update details, resubmit → RevisionNo++ |
| 4 | FinalApprover | Final approval + enter SAP vendor code → status = Completed |
| 5 | System | Generate downloadable PDF with all details + approval records |
| 6 | System | Email Buyer with approval confirmation + vendor code |

**Status flow:** `Draft → PendingApproval → PendingFinalApproval → Completed`
Rejection at any step → Buyer edits → resubmit (field-level diff tracked)

---

## 5. Vendor Form Fields
Vendor Name, Contact Info, Address, City (dropdown), Locality (dropdown), + other standard vendor info per sample form.

---

## 6. Revision Management
On each rejection+resubmission: new revision version created, tracking modified fields, who changed them, and revision number (REV 1, REV 2, …).

---

## 7. Features Summary
- Vendor registration form with dropdown master data (City, Locality)
- Multi-level approval workflow
- Rejection + resubmission with revision control + field-level diff
- SAP vendor code entry (FinalApprover)
- PDF document generation (Step 7 — pending)
- Email notification to Buyer on completion (Step 8 — pending)
- Approval history tracking + audit trail
