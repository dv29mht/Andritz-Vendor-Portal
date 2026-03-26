// ── Master data ───────────────────────────────────────────────────────────────
export const CITIES = {
  Mumbai:    ['Andheri', 'Bandra', 'Worli', 'Powai', 'Dadar'],
  Pune:      ['Hinjewadi', 'Kothrud', 'Viman Nagar', 'Hadapsar', 'Shivajinagar'],
  Delhi:     ['Connaught Place', 'Dwarka', 'Rohini', 'Lajpat Nagar', 'Saket'],
  'New Delhi': ['Connaught Place', 'Karol Bagh', 'Dwarka', 'Rohini', 'Saket'],
  Noida:     ['Sector 18', 'Sector 62', 'Sector 63', 'Greater Noida'],
  Gurugram:  ['DLF Phase 1', 'Cyber City', 'Sohna Road', 'Golf Course Road'],
  Gurgaon:   ['DLF Phase 1', 'Cyber City', 'Sohna Road', 'Golf Course Road'],
  Bengaluru: ['Whitefield', 'Electronic City', 'Koramangala', 'HSR Layout', 'Indiranagar'],
  Bangalore: ['Whitefield', 'Electronic City', 'Koramangala', 'HSR Layout', 'Indiranagar'],
  Chennai:   ['Anna Nagar', 'Adyar', 'T. Nagar', 'Velachery', 'Tambaram'],
  Hyderabad: ['Hitech City', 'Banjara Hills', 'Jubilee Hills', 'Secunderabad', 'Gachibowli'],
  Kolkata:   ['Salt Lake', 'Park Street', 'Howrah', 'Dum Dum', 'Rajarhat'],
  Ahmedabad: ['Navrangpura', 'Vastrapur', 'Bopal', 'SG Highway', 'Chandkheda'],
  Surat:     ['Adajan', 'Vesu', 'Katargam', 'Udhna'],
  Jaipur:    ['Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'C-Scheme'],
  Lucknow:   ['Gomti Nagar', 'Hazratganj', 'Aliganj', 'Indira Nagar'],
  Chandigarh:['Sector 17', 'Sector 22', 'Industrial Area', 'Mohali'],
  Kochi:     ['Ernakulam', 'Kakkanad', 'Edapally', 'Fort Kochi'],
}

export const CITY_STATE_MAP = {
  // Maharashtra
  Mumbai: 'Maharashtra', Pune: 'Maharashtra', Nagpur: 'Maharashtra',
  Nashik: 'Maharashtra', Aurangabad: 'Maharashtra', Solapur: 'Maharashtra',
  Thane: 'Maharashtra', Navi_Mumbai: 'Maharashtra',
  // Delhi / NCR
  Delhi: 'Delhi', 'New Delhi': 'Delhi', Noida: 'Uttar Pradesh',
  Gurugram: 'Haryana', Gurgaon: 'Haryana', Faridabad: 'Haryana',
  Ghaziabad: 'Uttar Pradesh',
  // Karnataka
  Bengaluru: 'Karnataka', Bangalore: 'Karnataka', Mysuru: 'Karnataka',
  Mysore: 'Karnataka', Hubli: 'Karnataka', Mangalore: 'Karnataka',
  // Tamil Nadu
  Chennai: 'Tamil Nadu', Coimbatore: 'Tamil Nadu', Madurai: 'Tamil Nadu',
  Salem: 'Tamil Nadu', Tiruchirappalli: 'Tamil Nadu',
  // Telangana / Andhra Pradesh
  Hyderabad: 'Telangana', Secunderabad: 'Telangana',
  Visakhapatnam: 'Andhra Pradesh', Vijayawada: 'Andhra Pradesh',
  // West Bengal
  Kolkata: 'West Bengal', Howrah: 'West Bengal', Durgapur: 'West Bengal',
  // Gujarat
  Ahmedabad: 'Gujarat', Surat: 'Gujarat', Vadodara: 'Gujarat',
  Rajkot: 'Gujarat', Gandhinagar: 'Gujarat',
  // Rajasthan
  Jaipur: 'Rajasthan', Jodhpur: 'Rajasthan', Udaipur: 'Rajasthan',
  Kota: 'Rajasthan',
  // Madhya Pradesh
  Indore: 'Madhya Pradesh', Bhopal: 'Madhya Pradesh', Gwalior: 'Madhya Pradesh',
  Jabalpur: 'Madhya Pradesh',
  // Uttar Pradesh
  Lucknow: 'Uttar Pradesh', Kanpur: 'Uttar Pradesh', Agra: 'Uttar Pradesh',
  Varanasi: 'Uttar Pradesh', Prayagraj: 'Uttar Pradesh', Allahabad: 'Uttar Pradesh',
  // Punjab / Haryana / Himachal
  Chandigarh: 'Chandigarh', Ludhiana: 'Punjab', Amritsar: 'Punjab',
  Jalandhar: 'Punjab', Ambala: 'Haryana', Shimla: 'Himachal Pradesh',
  // Bihar / Jharkhand
  Patna: 'Bihar', Ranchi: 'Jharkhand', Jamshedpur: 'Jharkhand',
  Dhanbad: 'Jharkhand',
  // Odisha / Assam / North East
  Bhubaneswar: 'Odisha', Cuttack: 'Odisha', Guwahati: 'Assam',
  // Kerala
  Kochi: 'Kerala', Thiruvananthapuram: 'Kerala', Kozhikode: 'Kerala',
  // Goa / Others
  Panaji: 'Goa', Dehradun: 'Uttarakhand', Raipur: 'Chhattisgarh',
}

// ── Users (maps to .NET Identity roles) ──────────────────────────────────────
export const USERS = {
  admin:        { id: 'admin-1',    name: 'Sunita Rao',     role: 'Admin',        email: 'sunita.rao@andritz.com' },
  buyer:        { id: 'buyer-1',    name: 'Vikram Nair',    role: 'Buyer',        email: 'vikram.nair@andritz.com' },
  approver:     { id: 'approver-1', name: 'Rajesh Kumar',   role: 'Approver',     email: 'rajesh.kumar@andritz.com' },
  finalApprover:{ id: 'final-1',    name: 'Pardeep Sharma', role: 'FinalApprover',email: 'pardeep.sharma@andritz.com' },
}

export const SELECTABLE_APPROVERS = [
  { id: 'approver-1', name: 'Rajesh Kumar',  email: 'rajesh.kumar@andritz.com' },
  { id: 'approver-2', name: 'Priya Mehta',   email: 'priya.mehta@andritz.com' },
  { id: 'approver-3', name: 'Amit Singh',    email: 'amit.singh@andritz.com' },
]

// ── Seed requests in every possible state ─────────────────────────────────────
export const INITIAL_REQUESTS = [
  {
    id: 1,
    vendorName: 'Tata Components Pvt. Ltd.',
    contactInformation: 'Ramesh Babu | +91 98765 43210 | ramesh@tatacomp.com',
    gstNumber: '27AABCT1332L1ZV',
    panCard: 'AABCT1332L',
    addressDetails: '14, Industrial Estate, Phase 2',
    city: 'Pune', locality: 'Hinjewadi',
    status: 'PendingApproval',
    revisionNo: 0, rejectionComment: null,
    vendorCode: null, vendorCodeAssignedAt: null, vendorCodeAssignedBy: null,
    createdByUserId: 'buyer-1', createdByName: 'Vikram Nair',
    createdAt: '2024-01-15T09:30:00Z', updatedAt: '2024-01-15T10:00:00Z',
    revisionHistory: [],
    approvalSteps: [
      { id: 101, approverUserId: 'approver-1', approverName: 'Rajesh Kumar', stepOrder: 1, decision: 'Pending', comment: null, decidedAt: null, isFinalApproval: false },
      { id: 102, approverUserId: 'final-1',    approverName: 'Pardeep Sharma', stepOrder: 2, decision: 'Pending', comment: null, decidedAt: null, isFinalApproval: true },
    ],
  },
  {
    id: 2,
    vendorName: 'Mahindra Steels Ltd.',
    contactInformation: 'Kavita Joshi | +91 87654 32109 | kavita@mahindrasteel.com',
    gstNumber: '',
    panCard: '',
    addressDetails: '7B, Commerce Centre, Floor 3',
    city: 'Mumbai', locality: 'Worli',
    status: 'Rejected',
    revisionNo: 0,
    rejectionComment: 'GST Number and PAN Card details are missing. Please update and resubmit.',
    vendorCode: null, vendorCodeAssignedAt: null, vendorCodeAssignedBy: null,
    createdByUserId: 'buyer-1', createdByName: 'Vikram Nair',
    createdAt: '2024-01-10T11:00:00Z', updatedAt: '2024-01-12T14:30:00Z',
    revisionHistory: [],
    approvalSteps: [
      { id: 201, approverUserId: 'approver-1', approverName: 'Rajesh Kumar', stepOrder: 1, decision: 'Rejected', comment: 'GST Number and PAN Card details are missing. Please update and resubmit.', decidedAt: '2024-01-12T14:30:00Z', isFinalApproval: false },
      { id: 202, approverUserId: 'final-1',    approverName: 'Pardeep Sharma', stepOrder: 2, decision: 'Pending', comment: null, decidedAt: null, isFinalApproval: true },
    ],
  },
  {
    id: 3,
    vendorName: 'Siemens Automation India',
    contactInformation: 'Arun Krishnan | +91 76543 21098 | arun@siemens-india.com',
    gstNumber: '07AABCS4598Q1ZK',
    panCard: 'AABCS4598Q',
    addressDetails: 'Plot 22, IT Park, Sector 14',
    city: 'Delhi', locality: 'Gurugram',
    status: 'PendingFinalApproval',
    revisionNo: 1, rejectionComment: null,
    vendorCode: null, vendorCodeAssignedAt: null, vendorCodeAssignedBy: null,
    createdByUserId: 'buyer-1', createdByName: 'Vikram Nair',
    createdAt: '2024-01-05T08:00:00Z', updatedAt: '2024-01-14T16:00:00Z',
    // REV 1 — shows a real diff in the Revision History tab
    revisionHistory: [
      {
        revisionNo: 1,
        changedByUserId: 'buyer-1',
        changedByName:   'Vikram Nair',
        changedAt:       '2024-01-09T10:15:00Z',
        rejectionComment: 'Company address is incomplete. Please provide the full address with plot number and sector.',
        changes: [
          {
            field:      'addressDetails',
            fieldLabel: 'Address Details',
            oldValue:   'Plot 22, IT Park',
            newValue:   'Plot 22, IT Park, Sector 14',
          },
          {
            field:      'contactInformation',
            fieldLabel: 'Contact Information',
            oldValue:   'Arun Krishnan | +91 76543 21098',
            newValue:   'Arun Krishnan | +91 76543 21098 | arun@siemens-india.com',
          },
        ],
      },
    ],
    approvalSteps: [
      { id: 301, approverUserId: 'approver-1', approverName: 'Rajesh Kumar', stepOrder: 1, decision: 'Approved', comment: 'All documents verified.', decidedAt: '2024-01-14T15:00:00Z', isFinalApproval: false },
      { id: 302, approverUserId: 'final-1',    approverName: 'Pardeep Sharma', stepOrder: 2, decision: 'Pending', comment: null, decidedAt: null, isFinalApproval: true },
    ],
  },
  {
    id: 4,
    vendorName: 'Bharat Forge Components',
    contactInformation: 'Deepak Sharma | +91 65432 10987 | deepak@bharatforge.com',
    gstNumber: '27AABCB2871M1Z3',
    panCard: 'AABCB2871M',
    addressDetails: '45, MIDC Area, Block C',
    city: 'Pune', locality: 'Viman Nagar',
    status: 'Completed',
    revisionNo: 0, rejectionComment: null,
    vendorCode: 'SAP-V-20240114-001',
    vendorCodeAssignedAt: '2024-01-14T12:00:00Z', vendorCodeAssignedBy: 'final-1',
    createdByUserId: 'buyer-1', createdByName: 'Vikram Nair',
    createdAt: '2024-01-01T09:00:00Z', updatedAt: '2024-01-14T12:00:00Z',
    revisionHistory: [],
    approvalSteps: [
      { id: 401, approverUserId: 'approver-1', approverName: 'Rajesh Kumar', stepOrder: 1, decision: 'Approved', comment: 'All clear.', decidedAt: '2024-01-13T11:00:00Z', isFinalApproval: false },
      { id: 402, approverUserId: 'final-1',    approverName: 'Pardeep Sharma', stepOrder: 2, decision: 'Approved', comment: 'Approved. Vendor code assigned from SAP.', decidedAt: '2024-01-14T12:00:00Z', isFinalApproval: true },
    ],
  },
  {
    id: 5,
    vendorName: 'Larsen & Toubro Electricals',
    contactInformation: 'Neha Kapoor | +91 54321 09876 | neha@ltelectricals.com',
    gstNumber: '29AAACL0187H1ZR',
    panCard: 'AAACL0187H',
    addressDetails: 'Tower B, L&T Business Park',
    city: 'Bengaluru', locality: 'Whitefield',
    status: 'Draft',
    revisionNo: 0, rejectionComment: null,
    vendorCode: null, vendorCodeAssignedAt: null, vendorCodeAssignedBy: null,
    createdByUserId: 'buyer-1', createdByName: 'Vikram Nair',
    createdAt: '2024-01-16T10:00:00Z', updatedAt: '2024-01-16T10:00:00Z',
    revisionHistory: [],
    approvalSteps: [
      { id: 501, approverUserId: 'approver-1', approverName: 'Rajesh Kumar', stepOrder: 1, decision: 'Pending', comment: null, decidedAt: null, isFinalApproval: false },
      { id: 502, approverUserId: 'final-1',    approverName: 'Pardeep Sharma', stepOrder: 2, decision: 'Pending', comment: null, decidedAt: null, isFinalApproval: true },
    ],
  },
]
