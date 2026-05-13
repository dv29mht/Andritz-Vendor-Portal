import * as XLSX from 'xlsx'

const dateTimeFmt = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

// Builds an Excel workbook from an array of requests with all the columns useful for
// admin/buyer/approver/final-approver views, then triggers a browser download.
export function exportRequestsToExcel(requests, filename = 'vendor_requests.xlsx') {
  const rows = requests.map((req, idx) => {
    const finalStep = req.approvalSteps?.find(s => s.isFinalApproval)
    const finalDecidedAt = finalStep?.decidedAt ?? req.vendorCodeAssignedAt
    return {
      '#':                  idx + 1,
      'Vendor Name':        req.vendorName ?? '',
      'SAP Vendor Code':    req.vendorCode ?? '',
      'Status':             req.status ?? '',
      'Revision':           req.revisionNo ?? 0,
      'Buyer':              req.createdByName ?? '',
      'Purchasing Org':     req.purchasingOrganization ?? '',
      'Material Group':     req.materialGroup ?? '',
      'MSME Category':      req.msmeCategory ?? '',
      'Reason':             req.reason ?? '',
      'Contact Person':     req.contactPerson || req.contactInformation || '',
      'Telephone':          req.telephone ?? '',
      'GST Number':         req.gstNumber ?? '',
      'PAN Card':           req.panCard ?? '',
      'Address':            req.addressDetails ?? '',
      'City':               req.city ?? '',
      'Locality':           req.locality ?? '',
      'State':              req.state ?? '',
      'Country':            req.country ?? '',
      'Postal Code':        req.postalCode ?? '',
      'Currency':           req.currency ?? '',
      'Payment Terms':      req.paymentTerms ?? '',
      'Incoterms':          req.incoterms ?? '',
      'Yearly PVO':         req.yearlyPvo ?? '',
      'Proposed By':        req.proposedBy ?? '',
      'Bank Name':          req.bankName ?? '',
      'Branch Name':        req.branchName ?? '',
      'Bank Account No':    req.bankAccountNumber ?? '',
      'IFSC Code':          req.ifscCode ?? '',
      'One-Time Vendor':    req.isOneTimeVendor ? 'Yes' : 'No',
      'Created On':         dateTimeFmt(req.createdAt),
      'Final Approval On':  dateTimeFmt(finalDecidedAt),
      'Last Updated':       dateTimeFmt(req.updatedAt),
      'Final Approver':     finalStep?.approverName ?? '',
      'Final Decision':     finalStep?.decision ?? '',
      'Vendor Code Assigned By': req.vendorCodeAssignedBy ?? '',
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Auto-widen columns based on header length (+ a touch of headroom)
  if (rows.length > 0) {
    const headers = Object.keys(rows[0])
    ws['!cols'] = headers.map(h => ({ wch: Math.min(40, Math.max(h.length + 2, 14)) }))
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Vendor Requests')
  XLSX.writeFile(wb, filename)
}

/** Formats a UTC timestamp as a locale-aware date+time string for inline display. */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}
