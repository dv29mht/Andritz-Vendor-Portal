import { useState, useRef } from 'react'
import {
  DocumentTextIcon, ClockIcon, PrinterIcon,
  CheckCircleIcon, XCircleIcon, ArrowRightIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import Modal from './shared/Modal'
import StatusBadge from './shared/StatusBadge'
import ApprovalTimeline from './shared/ApprovalTimeline'
import clsx from 'clsx'

const TABS = [
  { id: 'details',   label: 'Details',          icon: DocumentTextIcon },
  { id: 'revisions', label: 'Revision History',  icon: ClockIcon        },
  { id: 'preview',   label: 'Form Preview',      icon: PrinterIcon      },
]

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function VendorDetailModal({ request, onClose, initialTab = 'details' }) {
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <Modal
      title={request.vendorName}
      onClose={onClose}
      size="lg"
    >
      {/* Status + revision badge */}
      <div className="flex items-center gap-2 mb-4 -mt-1">
        <StatusBadge status={request.status} size="md" />
        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
          {request.revisionNo === 0 ? 'Original' : `REV ${request.revisionNo}`}
        </span>
        {request.vendorCode && (
          <span className="text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset px-2.5 py-1 rounded-full font-mono font-medium">
            {request.vendorCode}
          </span>
        )}
        {request.isOneTimeVendor && (
          <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2.5 py-1 rounded-full font-medium">
            One-Time Vendor
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1 mb-5">
        {TABS.map(t => {
          const Icon    = t.icon
          const isActive = t.id === activeTab
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === 'revisions' && request.revisionHistory?.length > 0 && (
                <span className={clsx(
                  'ml-0.5 rounded-full h-4 min-w-4 px-1 text-[10px] flex items-center justify-center font-bold',
                  isActive ? 'bg-[#096fb3] text-white' : 'bg-gray-300 text-gray-600'
                )}>
                  {request.revisionHistory.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab panels */}
      {activeTab === 'details'   && <DetailsTab   request={request} />}
      {activeTab === 'revisions' && <RevisionsTab request={request} />}
      {activeTab === 'preview'   && <PreviewTab   request={request} />}
    </Modal>
  )
}

// ── Tab: Details ──────────────────────────────────────────────────────────────

function DetailsTab({ request }) {
  const contact = request.contactPerson || request.contactInformation
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-5">
        <InfoTable title="Vendor Information" rows={[
          ['Vendor Name',     request.vendorName],
          ['Material Group',  request.materialGroup],
          ['Reason',          request.reason],
          ['GST Number',      request.gstNumber, true],
          ['PAN Card',        request.panCard,   true],
          ['One-Time Vendor', request.isOneTimeVendor ? 'Yes' : 'No'],
          ['Proposed By',     request.proposedBy],
        ]} />

        <InfoTable title="Address" rows={[
          ['Street / Building', request.addressDetails],
          ['City / Locality',   [request.city, request.locality, request.state, request.postalCode].filter(Boolean).join(', ')],
          ['Country',           request.country || 'India'],
        ]} />

        <InfoTable title="Commercial Terms" rows={[
          ['Currency',      request.currency || 'INR'],
          ['Payment Terms', request.paymentTerms],
          ['Incoterms',     request.incoterms],
          ['Yearly PVO',    request.yearlyPvo],
        ]} />

        <InfoTable title="Contact" rows={[
          ['Contact Person', contact],
          ['Telephone',      request.telephone],
        ]} />

        <InfoTable title="Submission" rows={[
          ['Submitted By',  request.createdByName],
          ['Created',       fmtDate(request.createdAt)],
          ['Last Updated',  fmtDate(request.updatedAt)],
        ]} />

        {request.vendorCode && (
          <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 p-4 flex items-center gap-3">
            <CheckBadgeIcon className="h-7 w-7 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider mb-0.5">SAP Vendor Code</p>
              <p className="font-mono text-lg font-bold text-emerald-700 tracking-widest">{request.vendorCode}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Assigned by {request.vendorCodeAssignedBy ?? 'Final Approver'} · {fmtDate(request.vendorCodeAssignedAt)}
              </p>
            </div>
          </div>
        )}

        {request.rejectionComment && (
          <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Rejection Reason</p>
            <p className="text-sm text-red-800">"{request.rejectionComment}"</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 pb-1.5 border-b border-gray-100">
          Approval Chain
        </p>
        <ApprovalTimeline steps={request.approvalSteps} />
      </div>
    </div>
  )
}

// ── Info Table ────────────────────────────────────────────────────────────────

function InfoTable({ title, rows }) {
  const filtered = rows.filter(([, val]) => val)
  if (filtered.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pb-1.5 border-b border-gray-100">
        {title}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {filtered.map(([label, value, mono]) => (
            <tr key={label} className="border-b border-gray-50 last:border-0">
              <td className="py-2 pr-6 text-gray-400 text-xs font-medium w-2/5 align-top">{label}</td>
              <td className={`py-2 text-gray-900 font-medium break-words ${mono ? 'font-mono tracking-wider text-gray-700' : ''}`}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab: Revision History (BRD §5) ───────────────────────────────────────────

function downloadRevisionCsv(request) {
  const history = request.revisionHistory ?? []
  const rows = [['Revision', 'Changed By', 'Changed At', 'Rejection Reason', 'Field', 'Old Value', 'New Value']]

  if (history.length === 0) {
    rows.push(['Original Submission', request.createdByName, fmtDate(request.createdAt), '', '', '', ''])
  } else {
    rows.push(['0 (Original)', request.createdByName, fmtDate(request.createdAt), '', '', '', ''])
    history.forEach(entry => {
      if (entry.changes.length === 0) {
        rows.push([`REV ${entry.revisionNo}`, entry.changedByName, fmtDate(entry.changedAt), entry.rejectionComment ?? '', '(no field changes)', '', ''])
      } else {
        entry.changes.forEach((c, i) => {
          rows.push([
            i === 0 ? `REV ${entry.revisionNo}` : '',
            i === 0 ? entry.changedByName : '',
            i === 0 ? fmtDate(entry.changedAt) : '',
            i === 0 ? (entry.rejectionComment ?? '') : '',
            c.fieldLabel,
            c.oldValue ?? '',
            c.newValue ?? '',
          ])
        })
      }
    })
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `revision-history-${request.vendorName.replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadRevisionPdf(request) {
  const history = request.revisionHistory ?? []
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const revRows = history.length === 0
    ? `<tr><td>0 (Original)</td><td>${esc(request.createdByName)}</td><td>${esc(fmtDate(request.createdAt))}</td><td></td><td>(original)</td><td></td><td></td></tr>`
    : [
        `<tr><td>0 (Original)</td><td>${esc(request.createdByName)}</td><td>${esc(fmtDate(request.createdAt))}</td><td></td><td></td><td></td><td></td></tr>`,
        ...history.flatMap(e => e.changes.length === 0
          ? [`<tr><td>REV ${e.revisionNo}</td><td>${esc(e.changedByName)}</td><td>${esc(fmtDate(e.changedAt))}</td><td>${esc(e.rejectionComment)}</td><td>(no field changes)</td><td></td><td></td></tr>`]
          : e.changes.map((c, i) => `<tr><td>${i === 0 ? `REV ${e.revisionNo}` : ''}</td><td>${i === 0 ? esc(e.changedByName) : ''}</td><td>${i === 0 ? esc(fmtDate(e.changedAt)) : ''}</td><td>${i === 0 ? esc(e.rejectionComment) : ''}</td><td>${esc(c.fieldLabel)}</td><td>${esc(c.oldValue)}</td><td>${esc(c.newValue)}</td></tr>`)
        )
      ].join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Revision History — ${esc(request.vendorName)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 24px; color: #1f2937; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p.sub { color: #6b7280; margin: 0 0 16px; font-size: 11px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #064e80; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  @media print { body { margin: 12px; } }
</style></head><body>
<h1>Revision History — ${esc(request.vendorName)}</h1>
<p class="sub">Generated on ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })} &nbsp;·&nbsp; Status: ${esc(request.status)}</p>
<table><thead><tr><th>Revision</th><th>Changed By</th><th>Changed At</th><th>Rejection Reason</th><th>Field</th><th>Old Value</th><th>New Value</th></tr></thead>
<tbody>${revRows}</tbody></table>
</body></html>`

  const w = window.open('', '_blank', 'width=900,height=650')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 400)
}

function RevisionsTab({ request }) {
  const history = request.revisionHistory ?? []

  if (history.length === 0) {
    return (
      <div className="py-10 text-center">
        <ClockIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">No revisions — Original submission</p>
        <p className="text-xs text-gray-400 mt-1">
          This request has not been edited since it was first submitted.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Download buttons */}
      <div className="flex justify-end gap-2 -mt-1">
        <button
          onClick={() => downloadRevisionPdf(request)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          <PrinterIcon className="h-3.5 w-3.5" />
          Download PDF
        </button>
        <button
          onClick={() => downloadRevisionCsv(request)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          Download Excel
        </button>
      </div>

      {/* Original submission anchor */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-gray-500">0</span>
          </div>
          <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[2rem]" />
        </div>
        <div className="pb-4 pt-1">
          <p className="text-sm font-semibold text-gray-700">Original Submission</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {request.createdByName} · {fmtDate(request.createdAt)}
          </p>
        </div>
      </div>

      {/* Each revision */}
      {history.map((entry, idx) => (
        <div key={entry.revisionNo} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-amber-700">{entry.revisionNo}</span>
            </div>
            {idx < history.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[2rem]" />
            )}
          </div>

          <div className="flex-1 pb-4 pt-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-800">REV {entry.revisionNo}</p>
              <span className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">
                Resubmitted
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {entry.changedByName} · {fmtDate(entry.changedAt)}
            </p>

            {entry.rejectionComment && (
              <div className="mt-2 rounded-md bg-red-50 ring-1 ring-red-100 px-3 py-2">
                <p className="text-xs text-red-500 font-medium">Rejected because:</p>
                <p className="text-xs text-red-700 mt-0.5 italic">"{entry.rejectionComment}"</p>
              </div>
            )}

            {entry.changes.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {entry.changes.length} field{entry.changes.length !== 1 ? 's' : ''} changed
                </p>
                {entry.changes.map(c => (
                  <div key={c.field} className="rounded-lg bg-gray-50 ring-1 ring-gray-100 p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1.5">{c.fieldLabel}</p>
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="rounded bg-red-50 ring-1 ring-red-100 px-2 py-1 text-xs text-red-700 line-through max-w-xs">
                        {c.oldValue || '—'}
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-1" />
                      <div className="rounded bg-emerald-50 ring-1 ring-emerald-100 px-2 py-1 text-xs text-emerald-700 max-w-xs">
                        {c.newValue || '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-400 italic">No field-level changes detected — resubmitted as-is.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Form Preview ─────────────────────────────────────────────────────────

function PreviewTab({ request }) {
  const paperRef = useRef(null)
  const sorted = [...request.approvalSteps].sort((a, b) => a.stepOrder - b.stepOrder)
  const formNo = `VRF-${String(request.id).padStart(4, '0')}`

  const handleDownloadPdf = () => {
    // Build PDF HTML from data — never from DOM serialization — to prevent XSS
    // and avoid any CDN dependency.
    const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    const row = (no, label, value, mono = false) => `
      <tr>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px;color:#666;width:30%">${esc(no)}. ${esc(label)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:11px;${mono ? 'font-family:monospace;' : ''}">${esc(value)}</td>
      </tr>`
    const sec = (letter, title) => `
      <tr><td colspan="2" style="padding:6px 8px;background:#f3f4f6;font-weight:700;font-size:11px;border:1px solid #ddd;letter-spacing:.05em">
        ${esc(letter)}. ${esc(title)}
      </td></tr>`
    const stepDecision = (d) => d === 'Approved' ? '✓ Approved' : d === 'Rejected' ? '✗ Rejected' : '— Pending'

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(formNo)} — Vendor Registration Form</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;background:#fff;color:#111;margin:0;padding:32px 40px}
    h1{font-size:18px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;margin:0}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{padding:5px 8px;background:#e5e7eb;font-size:10px;border:1px solid #ccc;text-align:left}
    @media print{@page{margin:1cm;size:A4}body{margin:0;padding:20px}}
  </style>
</head>
<body>
  <div style="text-align:center;border-bottom:2px solid #222;padding-bottom:12px;margin-bottom:16px">
    <h1>ANDRITZ</h1>
    <p style="font-size:10px;color:#666;letter-spacing:.15em;margin:2px 0">INDIA PRIVATE LIMITED</p>
    <p style="font-size:13px;font-weight:700;letter-spacing:.1em;margin-top:8px">VENDOR REGISTRATION FORM</p>
  </div>
  <table>
    <tr>
      <td style="padding:4px 8px;font-size:10px;color:#666;width:50%">Form No.: <strong>${esc(formNo)}</strong></td>
      <td style="padding:4px 8px;font-size:10px;color:#666">Date: <strong>${esc(fmtDateFull(request.createdAt))}</strong></td>
    </tr>
    <tr>
      <td style="padding:4px 8px;font-size:10px;color:#666">Status: <strong>${esc(request.status.replace(/([A-Z])/g,' $1').trim())}</strong></td>
      <td style="padding:4px 8px;font-size:10px;color:#666">Revision: <strong>${esc(request.revisionNo === 0 ? 'Original' : `REV ${request.revisionNo}`)}</strong></td>
    </tr>
  </table>
  <table>
    ${sec('A','Vendor Particulars')}
    ${row(1,'Vendor / Company Name',request.vendorName)}
    ${row(2,'Material Group',request.materialGroup)}
    ${row(3,'Reason',request.reason)}
    ${row(4,'GST Number',request.gstNumber,true)}
    ${row(5,'PAN Card',request.panCard,true)}
    ${row(6,'Proposed By',request.proposedBy)}
    ${row(7,'One-Time Vendor',request.isOneTimeVendor ? 'Yes' : 'No')}
    ${sec('B','Address Details')}
    ${row(8,'Street / Building / Plot',request.addressDetails)}
    ${row(9,'Postal Code',request.postalCode)}
    ${row(10,'City',request.city)}
    ${row(11,'Locality',request.locality)}
    ${row(12,'State',request.state)}
    ${row(13,'Country',request.country || 'India')}
    ${sec('C','Commercial Terms')}
    ${row(14,'Currency',request.currency || 'INR')}
    ${row(15,'Payment Terms',request.paymentTerms)}
    ${row(16,'Incoterms',request.incoterms)}
    ${row(17,'Yearly PVO',request.yearlyPvo)}
    ${sec('D','Contact Details')}
    ${row(18,'Contact Person',request.contactPerson)}
    ${row(19,'Telephone',request.telephone)}
  </table>
  <p style="font-size:11px;font-weight:700;letter-spacing:.05em;margin-bottom:6px">E. APPROVAL RECORD</p>
  <table>
    <thead><tr>
      <th>Step</th><th>Approver</th><th>Decision</th><th>Date</th><th>Remarks</th>
    </tr></thead>
    <tbody>
      ${sorted.map(s => `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${esc(s.isFinalApproval ? 'Final' : `Step ${s.stepOrder}`)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${esc(s.approverName)}${s.isFinalApproval ? ' (FA)' : ''}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${esc(stepDecision(s.decision))}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${s.decidedAt ? esc(new Date(s.decidedAt).toLocaleDateString('en-IN',{dateStyle:'medium'})) : '—'}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;font-size:10px">${esc(s.comment ?? '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  ${request.vendorCode ? `<p style="margin-top:16px;font-size:11px">SAP Vendor Code: <strong style="font-family:monospace;font-size:14px">${esc(request.vendorCode)}</strong></p>` : ''}
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},600)});<\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=1000')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  return (
    <div>
      {/* Download button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 rounded-lg bg-[#096fb3] text-white text-sm font-semibold px-4 py-2 hover:bg-[#075d99] transition-colors"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      <div className="overflow-x-auto">
        {/* Paper document */}
        <div
          ref={paperRef}
          className="mx-auto bg-white border border-gray-300 shadow-md font-serif text-gray-900 min-w-[480px]"
          style={{ width: '680px', padding: '40px 48px' }}
        >
          {/* ── Company Header ── */}
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="h-8 w-1.5 bg-[#096fb3]" />
              <p className="text-2xl font-extrabold tracking-widest uppercase font-sans text-gray-900">ANDRITZ</p>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-sans">India Private Limited</p>
            <p className="text-base font-bold uppercase tracking-wider mt-3">Vendor Registration Form</p>
          </div>

          {/* ── Document meta ── */}
          <div className="grid grid-cols-2 gap-x-8 mb-6 text-xs font-sans">
            <DocRow label="Form No."       value={formNo} />
            <DocRow label="Date"           value={fmtDateFull(request.createdAt)} />
            <DocRow label="Status"         value={request.status.replace(/([A-Z])/g, ' $1').trim()} />
            <DocRow label="Revision"       value={request.revisionNo === 0 ? 'Original' : `REV ${request.revisionNo}`} />
          </div>

          <hr className="border-gray-300 mb-5" />

          {/* ── Section A: Vendor Particulars ── */}
          <SectionHeader letter="A" title="Vendor Particulars" />
          <FormRow no="1" label="Vendor / Company Name"   value={request.vendorName} />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="2" label="Material Group" value={request.materialGroup} />
            <FormRow no="3" label="Reason"         value={request.reason} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="4" label="GST Number" value={request.gstNumber} mono />
            <FormRow no="5" label="PAN Card"   value={request.panCard}   mono />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="6" label="Proposed By"     value={request.proposedBy} />
            <FormRow no="7" label="One-Time Vendor" value={request.isOneTimeVendor ? 'Yes' : 'No'} />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section B: Address ── */}
          <SectionHeader letter="B" title="Address Details" />
          <FormRow no="8" label="Street / Building / Plot" value={request.addressDetails} />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="9"  label="Postal Code" value={request.postalCode} />
            <FormRow no="10" label="City"        value={request.city} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="11" label="Locality" value={request.locality} />
            <FormRow no="12" label="State"    value={request.state} />
          </div>
          <FormRow no="13" label="Country" value={request.country || 'India'} />

          <hr className="border-gray-200 my-4" />

          {/* ── Section C: Commercial Terms ── */}
          <SectionHeader letter="C" title="Commercial Terms" />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="14" label="Currency"      value={request.currency     || 'INR'} />
            <FormRow no="15" label="Payment Terms" value={request.paymentTerms} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="16" label="Incoterms"  value={request.incoterms} />
            <FormRow no="17" label="Yearly PVO" value={request.yearlyPvo} />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section D: Contact ── */}
          <SectionHeader letter="D" title="Contact Details" />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="18" label="Contact Person" value={request.contactPerson || request.contactInformation} />
            <FormRow no="19" label="Telephone"      value={request.telephone} />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section E: Approval Record ── */}
          <SectionHeader letter="E" title="Approval Record" />
          <table className="w-full text-xs border-collapse mb-1 font-sans">
            <thead>
              <tr className="bg-gray-100">
                <Th>Step</Th>
                <Th>Approver</Th>
                <Th>Decision</Th>
                <Th>Date</Th>
                <Th>Remarks</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.id} className="border-b border-gray-200">
                  <Td>{s.isFinalApproval ? 'Final' : `Step ${s.stepOrder}`}</Td>
                  <Td>
                    {s.approverName}
                    {s.isFinalApproval && <span className="text-[10px] text-blue-600 ml-1">(FA)</span>}
                  </Td>
                  <Td>
                    {s.decision === 'Approved' && (
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircleIcon className="h-3.5 w-3.5" /> Approved
                      </span>
                    )}
                    {s.decision === 'Rejected' && (
                      <span className="flex items-center gap-1 text-red-700 font-semibold">
                        <XCircleIcon className="h-3.5 w-3.5" /> Rejected
                      </span>
                    )}
                    {s.decision === 'Pending' && (
                      <span className="text-amber-600 italic">Pending</span>
                    )}
                  </Td>
                  <Td>{s.decidedAt ? fmtDateShort(s.decidedAt) : '—'}</Td>
                  <Td className="italic text-gray-500">{s.comment ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr className="border-gray-200 my-4" />

          {/* ── Section F: SAP Vendor Code ── */}
          <SectionHeader letter="F" title="SAP Vendor Code" />
          {request.vendorCode ? (
            <div className="grid grid-cols-2 gap-4">
              <FormRow no="20" label="Vendor Code (SAP)" value={request.vendorCode} mono />
              <FormRow no="21" label="Date Assigned"     value={fmtDateFull(request.vendorCodeAssignedAt)} />
              <FormRow no=""   label="Assigned By"       value="Pardeep Sharma (Final Approver)" />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic mb-4">
              Vendor Code will be assigned upon final approval.
            </p>
          )}

          <hr className="border-gray-200 my-4" />

          {/* ── Declaration ── */}
          <div className="border border-gray-300 rounded p-3 mb-6">
            <p className="text-[11px] text-gray-600 leading-relaxed font-sans">
              <strong>Declaration:</strong> I/We hereby certify that the information provided above is true,
              accurate and complete to the best of my/our knowledge. I/We understand that any misrepresentation
              may result in the rejection of this registration. I/We agree to comply with the procurement
              policies and terms of Andritz India Private Limited.
            </p>
          </div>

          {/* ── Signature blocks ── */}
          <div className="grid grid-cols-2 gap-8 font-sans text-xs">
            <SignatureBlock label="Buyer Signature" name={request.createdByName} />
            <SignatureBlock label="Final Approver Signature" name="Pardeep Sharma" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Small sub-components ──────────────────────────────────────────────────────

function SectionHeader({ letter, title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-5 w-5 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-white">{letter}</span>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-700 font-sans">{title}</p>
    </div>
  )
}

function FormRow({ no, label, value, mono = false }) {
  return (
    <div className="mb-3">
      <div className="flex gap-1.5 items-baseline mb-0.5">
        {no && <span className="text-[10px] text-gray-400 font-sans w-4 flex-shrink-0">{no}.</span>}
        <label className="text-[10px] text-gray-500 uppercase tracking-wider font-sans">{label}</label>
      </div>
      <div className="border-b border-gray-300 pb-0.5 ml-5">
        <span className={`text-sm text-gray-900 ${mono ? 'font-mono tracking-widest font-bold text-emerald-700' : ''}`}>
          {value || <span className="text-gray-300 italic text-xs">—</span>}
        </span>
      </div>
    </div>
  )
}

function DocRow({ label, value }) {
  return (
    <div className="flex gap-2 items-baseline mb-1">
      <span className="text-gray-500 w-24 flex-shrink-0">{label}:</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  )
}

function Th({ children }) {
  return <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 bg-gray-50">{children}</th>
}

function Td({ children, className = '' }) {
  return <td className={`border border-gray-200 px-2 py-1.5 align-top ${className}`}>{children}</td>
}

function SignatureBlock({ label, name }) {
  return (
    <div>
      <div className="border-b-2 border-gray-400 h-10 mb-1" />
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-gray-700 font-medium">{name}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">Date: _______________</p>
    </div>
  )
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const fmtDate     = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const fmtDateFull = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
const fmtDateShort= (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
