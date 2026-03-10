1. Project Overview

The Andritz Vendor Registration Portal will be developed to streamline the process of vendor registration, approval, and vendor code generation. The system will allow Buyers to initiate vendor registration requests, route them through an approval workflow, and finally generate a vendor code after approval.

The system will also maintain revision history for any modifications made to vendor details.

---

2. Objectives

The main objectives of the system are:

· Digitize the vendor registration process.

· Provide a structured approval workflow.

· Maintain transparency and audit trail of vendor information.

· Enable revision tracking for vendor detail changes.

· Generate a downloadable vendor registration document.

· Automatically notify users via email after vendor approval.

---

3. User Roles

3.1 Admin

The Admin will manage system configurations and master data.

Responsibilities include:

· The Admin will create employee profiles in the system and assign roles such as Buyer and Approver.

· The Admin will manage and control the user role assignments.

· The Admin will have visibility of all vendor registration requests created by Buyers in one place.

· The Admin can check the status of each request (Pending, Approved, Rejected).

· The Admin will also be able to download the vendor registration document in PDF format when required.

3.2 Buyer

The Buyer is responsible for initiating the vendor registration request.

Responsibilities include:

· Creating new vendor registration requests

· Filling vendor details

· Selecting approvers

· Updating requests in case of rejection

· Receiving vendor code after approval

3.3 Approver

Approvers review vendor registration requests and either approve or reject them.

Responsibilities include:

· Reviewing vendor details

· Approving requests

· Rejecting requests with comments if corrections are required

3.4 Final Approver

The final approver will be Pardeep Sharma.

Responsibilities include:

· Final approval of the vendor request

· Manually adding the vendor code generated from SAP

· Completing the final submission

---

4. Vendor Registration Workflow

Step 1 – Vendor Request Creation

· The Buyer will create a New Vendor Registration Request.

· The Buyer will fill in all required vendor details in the form.

Vendor details may include:

· Vendor Name

· Contact Information

· Address Details

· City (Dropdown)

· Locality (Dropdown)

· Other required vendor information.( The Sample form attached below) Andritz- Vendor Registration Sample Form.xlsx

---

Step 2 – Approver Selection

· The Buyer will select the Approver(s) from a predefined list.

· The approval flow will start once the request is submitted.

---

Step 3 – Approval Process

· The approver will receive a task to review the vendor request.

· The approver can:

o Approve the request

o Reject the request with comments

---

Step 4 – Rejection Scenario

If the request is rejected:

· The Buyer will receive the rejection comments.

· The Buyer will update the required vendor details.

· The system will create a revision version (REV 1) of the request.

· The updated request will be resubmitted for approval.

The system will maintain revision history for audit purposes.

---

Step 5 – Final Approval

After all intermediate approvals are completed:

· The request will be forwarded to the final approver Pardeep Sharma.

---

Step 6 – Vendor Code Generation

After final approval:

· The final approver will manually add the Vendor Code generated from SAP.

· The request will then be finally submitted in the system.

---

Step 7 – Document Generation

After final submission:

· The vendor registration record will be converted into a downloadable PDF document.

· The document will contain all vendor details and approval records.

---

Step 8 – Email Notification

Once the vendor is successfully approved and the vendor code is generated:

· An email notification will be triggered to the Buyer.

· The email will include:

o Vendor approval confirmation

o Vendor Code

---

5. Revision Management

If any changes are required in vendor details:

· The system will create a new revision version of the vendor record.

· The system will track:

o What fields were modified

o Who made the changes

o Revision number

This ensures complete audit trail and transparency.

---

6. Key System Features

The system will provide the following key features:

· Vendor registration form

· Dropdown master data (City, Locality)

· Multi-level approval workflow

· Rejection and resubmission flow

· Revision control for vendor changes

· Vendor code entry

· PDF document generation

· Email notification system

· Approval history tracking

---