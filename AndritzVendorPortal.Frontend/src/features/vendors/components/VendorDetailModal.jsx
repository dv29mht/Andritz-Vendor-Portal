import { useState, useRef, useEffect } from 'react'
import {
  DocumentTextIcon, ClockIcon, PrinterIcon,
  CheckCircleIcon, XCircleIcon, ArrowRightIcon,
  ArrowDownTrayIcon, EyeIcon, PaperClipIcon,
} from '@heroicons/react/24/outline'
import { CheckBadgeIcon } from '@heroicons/react/24/solid'
import Modal from '../../../shared/components/Modal'
import StatusBadge from '../../../shared/components/StatusBadge'
import ApprovalTimeline from '../../../shared/components/ApprovalTimeline'
import clsx from 'clsx'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useAuth } from '../../auth/hooks/useAuth'
import { vendorsService } from '../services/vendorsService'

// Document slots may be a single legacy data: URL string or a JSON array of { name, data }.
function parseDocs(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return []
    if (s.startsWith('[')) {
      try { const a = JSON.parse(s); return Array.isArray(a) ? a.filter(d => d?.data) : [] }
      catch { return [] }
    }
    if (s.startsWith('data:')) return [{ name: 'Document', data: s }]
  }
  return []
}

// Opens a stored document: PDFs/images in a new tab, everything else downloads.
async function previewDoc(doc) {
  if (!doc?.data) return
  try {
    const resp = await fetch(doc.data)
    const blob = await resp.blob()
    const url  = URL.createObjectURL(blob)
    const mime = (blob.type || '').toLowerCase()
    if (mime === 'application/pdf' || mime.startsWith('image/')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name || 'document'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    window.open(doc.data, '_blank', 'noopener,noreferrer')
  }
}

const TABS = [
  { id: 'details',   label: 'Details',          icon: DocumentTextIcon },
  { id: 'revisions', label: 'Revision History',  icon: ClockIcon        },
  { id: 'preview',   label: 'Form Preview',      icon: PrinterIcon      },
]

// ── Main Modal ─────────────────────────────────────────────────────────────────

export default function VendorDetailModal({ request, onClose, initialTab = 'details' }) {
  const { currentUser } = useAuth()
  // If the viewer is the creator, use their live auth-context name so stale
  // DB snapshots don't show an outdated display name.
  const liveCreatorName = (currentUser?.id && currentUser.id === request.createdByUserId)
    ? (currentUser.name ?? currentUser.fullName ?? request.createdByName)
    : request.createdByName
  const req = { ...request, createdByName: liveCreatorName }

  const [activeTab, setActiveTab] = useState(initialTab)

  // The list payload omits document blobs (for size); fetch the full record so the
  // attached GST / PAN / bank documents are available to preview in the Details tab.
  const [docs, setDocs] = useState(null)
  useEffect(() => {
    let alive = true
    vendorsService.one(request.id)
      .then(full => { if (alive && full) setDocs(full) })
      .catch(() => { /* documents simply won't be available to preview */ })
    return () => { alive = false }
  }, [request.id])

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
      {activeTab === 'details'   && <DetailsTab   request={req} docs={docs} />}
      {activeTab === 'revisions' && <RevisionsTab request={req} />}
      {activeTab === 'preview'   && <PreviewTab   request={req} />}
    </Modal>
  )
}

// ── Tab: Details ──────────────────────────────────────────────────────────────

function DetailsTab({ request, docs }) {
  const contact = request.contactPerson || request.contactInformation
  // Prefer the full record (with document blobs) once it has loaded.
  const docSource = docs ?? request
  const docGroups = [
    { label: 'GST Document',        files: parseDocs(docSource.gstDocument) },
    { label: 'PAN Document',        files: parseDocs(docSource.panDocument) },
    { label: 'Bank Document',       files: parseDocs(docSource.bankDocument1) },
    { label: 'Additional Documents', files: parseDocs(docSource.bankDocument2) },
  ].filter(g => g.files.length > 0)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-5">
        <InfoTable title="Vendor Information" rows={[
          ['Vendor Name',            request.vendorName],
          ['Purchasing Organization', request.purchasingOrganization],
          ['Material Group',         request.materialGroup],
          ['Reason',                 request.reason],
          ['GST Number',             request.gstNumber, true],
          ['PAN Card',               request.panCard,   true],
          ['MSME Vendor',            request.msmeCategory ? `Yes — ${request.msmeCategory}` : 'No'],
          ['One-Time Vendor',        request.isOneTimeVendor ? 'Yes' : 'No'],
          ['Proposed By',            request.proposedBy],
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

        <InfoTable title="Banking Details" rows={[
          ['Bank Name',          request.bankName],
          ['Branch Name',        request.branchName],
          ['Bank Account Number', request.bankAccountNumber, true],
          ['IFSC Code',          request.ifscCode, true],
        ]} />

        <InfoTable title="Contact" rows={[
          ['Contact Person', contact],
          ['Telephone',      request.telephone],
          ['Email ID',       request.email],
        ]} />

        {/* Attached documents — previewable by any viewer (buyer, approver, admin). */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pb-1.5 border-b border-gray-100">
            Documents
          </p>
          {docGroups.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-1">
              {docs === null ? 'Loading attachments…' : 'No documents attached.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {docGroups.flatMap(g =>
                g.files.map((file, i) => (
                  <li key={`${g.label}-${i}`} className="flex items-center gap-2 rounded-lg bg-gray-50 ring-1 ring-gray-100 px-3 py-2">
                    <PaperClipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{file.name || 'Document'}</p>
                      <p className="text-[10px] text-gray-400">{g.label}{g.files.length > 1 ? ` (${i + 1} of ${g.files.length})` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => previewDoc(file)}
                      className="flex items-center gap-1 rounded-md border border-gray-200 text-gray-600 text-xs font-semibold px-2.5 py-1 hover:bg-white hover:text-[#096fb3] transition-colors flex-shrink-0"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

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
        <ApprovalTimeline steps={request.approvalSteps} requestStatus={request.status} />
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

function downloadRevisionExcel(request) {
  const history = request.revisionHistory ?? []
  const rejInfo = e => [e.rejectedByName, e.rejectionComment].filter(Boolean).join(': ')
  const rows = [['Revision', 'Changed By', 'Changed At', 'Rejected By / Reason', 'Field', 'Old Value', 'New Value']]

  if (history.length === 0) {
    rows.push(['Original Submission', request.createdByName, fmtDate(request.createdAt), '', '', '', ''])
  } else {
    rows.push(['0 (Original)', request.createdByName, fmtDate(request.createdAt), '', '', '', ''])
    history.forEach(entry => {
      if (entry.changes.length === 0) {
        rows.push([`REV ${entry.revisionNo}`, entry.changedByName, fmtDate(entry.changedAt), rejInfo(entry), '(no field changes)', '', ''])
      } else {
        entry.changes.forEach((c, i) => {
          rows.push([
            i === 0 ? `REV ${entry.revisionNo}` : '',
            i === 0 ? entry.changedByName : '',
            i === 0 ? fmtDate(entry.changedAt) : '',
            i === 0 ? rejInfo(entry) : '',
            c.fieldLabel,
            c.oldValue ?? '',
            c.newValue ?? '',
          ])
        })
      }
    })
  }

  // Emit a real .xlsx (not CSV) so it opens in Excel rather than Numbers on macOS.
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 28 }, { wch: 22 }, { wch: 26 }, { wch: 26 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Revision History')
  XLSX.writeFile(wb, `revision-history-${request.vendorName.replace(/\s+/g, '_')}.xlsx`)
}

function downloadRevisionPdf(request) {
  const history = request.revisionHistory ?? []
  const rejInfo = e => [e.rejectedByName, e.rejectionComment].filter(Boolean).join(': ')

  const body = history.length === 0
    ? [['0 (Original)', request.createdByName ?? '', fmtDate(request.createdAt), '', '(original)', '', '']]
    : [
        ['0 (Original)', request.createdByName ?? '', fmtDate(request.createdAt), '', '', '', ''],
        ...history.flatMap(e => e.changes.length === 0
          ? [[`REV ${e.revisionNo}`, e.changedByName ?? '', fmtDate(e.changedAt), rejInfo(e), '(no field changes)', '', '']]
          : e.changes.map((c, i) => [
              i === 0 ? `REV ${e.revisionNo}` : '',
              i === 0 ? (e.changedByName ?? '') : '',
              i === 0 ? fmtDate(e.changedAt) : '',
              i === 0 ? rejInfo(e) : '',
              c.fieldLabel ?? '',
              c.oldValue ?? '',
              c.newValue ?? '',
            ])
        ),
      ]

  // Generate a real PDF client-side and download it directly (no print dialog).
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const generatedOn = new Date().toLocaleDateString('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' })

  doc.setFontSize(14)
  doc.setTextColor(31, 41, 55)
  doc.text(`Revision History — ${request.vendorName}`, 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Generated on ${generatedOn}  ·  Status: ${request.status}`, 40, 56)

  autoTable(doc, {
    startY: 72,
    head: [['Revision', 'Changed By', 'Changed At', 'Rejected By / Reason', 'Field', 'Old Value', 'New Value']],
    body,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [6, 78, 128], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 40, right: 40 },
  })

  doc.save(`revision-history-${request.vendorName.replace(/\s+/g, '_')}.pdf`)
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
          <DocumentTextIcon className="h-3.5 w-3.5" />
          Download PDF
        </button>
        <button
          onClick={() => downloadRevisionExcel(request)}
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
              {entry.revisionType === 'CompletedReEdit' ? (
                <span className="text-xs text-blue-700 bg-blue-50 ring-1 ring-blue-200 ring-inset px-2 py-0.5 rounded-full">
                  Re-edited (Completed)
                </span>
              ) : entry.revisionType === 'AdminEdit' ? (
                <span className="text-xs text-purple-700 bg-purple-50 ring-1 ring-purple-200 ring-inset px-2 py-0.5 rounded-full">
                  Admin Edit
                </span>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">
                  Resubmitted
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {entry.changedByName} · {fmtDate(entry.changedAt)}
            </p>

            {(entry.rejectionComment || entry.rejectedByName) && (
              <div className="mt-2 rounded-md bg-red-50 ring-1 ring-red-100 px-3 py-2">
                <p className="text-xs text-red-500 font-medium">
                  {entry.rejectedByName ? `Rejected by ${entry.rejectedByName}` : 'Rejected'}
                </p>
                {entry.rejectionComment && (
                  <p className="text-xs text-red-700 mt-0.5 italic">"{entry.rejectionComment}"</p>
                )}
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
    // Generate a real PDF client-side and download it directly (no print dialog),
    // building from data — never DOM serialization — to prevent XSS.
    const val = (v) => (v === null || v === undefined) ? '' : String(v)
    const stepDecision = (d) => d === 'Approved' ? 'Approved' : d === 'Rejected' ? 'Rejected' : 'Pending'

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth  = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 40
    const ensureSpace = (y, needed = 48) => (y + needed > pageHeight - margin ? (doc.addPage(), margin + 8) : y)

    // ── Company header ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(17, 17, 17)
    doc.text('ANDRITZ', pageWidth / 2, 48, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(102, 102, 102)
    doc.text('INDIA PRIVATE LIMITED', pageWidth / 2, 60, { align: 'center' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(17, 17, 17)
    doc.text('VENDOR REGISTRATION FORM', pageWidth / 2, 76, { align: 'center' })
    doc.setDrawColor(34, 34, 34); doc.setLineWidth(1.5)
    doc.line(margin, 86, pageWidth - margin, 86)

    // ── Document meta ──
    autoTable(doc, {
      startY: 96,
      theme: 'plain',
      styles: { fontSize: 9, textColor: [102, 102, 102], cellPadding: 3 },
      body: [
        [`Form No.: ${formNo}`, `Date: ${fmtDateFull(request.createdAt)}`],
        [`Status: ${request.status.replace(/([A-Z])/g, ' $1').trim()}`, `Revision: ${request.revisionNo === 0 ? 'Original' : `REV ${request.revisionNo}`}`],
      ],
      margin: { left: margin, right: margin },
    })

    // ── Sections A–E (label / value pairs) ──
    const sec = (letter, title) => [{
      content: `${letter}. ${title}`,
      colSpan: 2,
      styles: { fillColor: [243, 244, 246], fontStyle: 'bold', textColor: [17, 17, 17], fontSize: 9.5 },
    }]
    const field = (no, label, value, mono = false) => [
      `${no}. ${label}`,
      { content: val(value), styles: mono ? { font: 'courier' } : {} },
    ]

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, lineColor: [221, 221, 221], lineWidth: 0.5, valign: 'middle' },
      columnStyles: { 0: { cellWidth: 205, textColor: [90, 90, 90] } },
      body: [
        sec('A', 'Vendor Particulars'),
        field(1, 'Vendor / Company Name', request.vendorName),
        field(2, 'Purchasing Organization', request.purchasingOrganization),
        field(3, 'Material Group', request.materialGroup),
        field(4, 'Reason', request.reason),
        field(5, 'GST Number', request.gstNumber, true),
        field(6, 'PAN Card', request.panCard, true),
        field(7, 'MSME Vendor', request.msmeCategory ? `Yes — ${request.msmeCategory}` : 'No'),
        field(8, 'Proposed By', request.proposedBy),
        field(9, 'One-Time Vendor', request.isOneTimeVendor ? 'Yes' : 'No'),
        sec('B', 'Address Details'),
        field(10, 'Street / Building / Plot', request.addressDetails),
        field(11, 'Postal Code', request.postalCode),
        field(12, 'City', request.city),
        field(13, 'Locality', request.locality),
        field(14, 'State', request.state),
        field(15, 'Country', request.country || 'India'),
        sec('C', 'Commercial Terms'),
        field(16, 'Currency', request.currency || 'INR'),
        field(17, 'Payment Terms', request.paymentTerms),
        field(18, 'Incoterms', request.incoterms),
        field(19, 'Yearly PVO', request.yearlyPvo),
        sec('D', 'Banking Details'),
        field(20, 'Bank Name', request.bankName),
        field(21, 'Branch Name', request.branchName),
        field(22, 'Bank Account Number', request.bankAccountNumber, true),
        field(23, 'IFSC Code', request.ifscCode, true),
        sec('E', 'Contact Details'),
        field(24, 'Contact Person', request.contactPerson),
        field(25, 'Telephone', request.telephone),
        field(26, 'Email ID', request.email),
      ],
      margin: { left: margin, right: margin },
    })

    // ── F. Approval record ──
    let y = ensureSpace(doc.lastAutoTable.finalY + 18)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(17, 17, 17)
    doc.text('F. APPROVAL RECORD', margin, y)

    autoTable(doc, {
      startY: y + 6,
      theme: 'grid',
      head: [['Step', 'Approver', 'Decision', 'Date', 'Remarks']],
      body: sorted.map(s => [
        s.isFinalApproval ? 'Final' : `Step ${s.stepOrder}`,
        `${s.approverName}${s.isFinalApproval ? ' (FA)' : ''}`,
        stepDecision(s.decision),
        s.decidedAt ? new Date(s.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }) : '—',
        s.comment ?? '',
      ]),
      styles: { fontSize: 9, cellPadding: 4, lineColor: [221, 221, 221], lineWidth: 0.5, overflow: 'linebreak' },
      headStyles: { fillColor: [229, 231, 235], textColor: [17, 17, 17], fontSize: 9 },
      margin: { left: margin, right: margin },
    })

    // ── SAP Vendor Code (once assigned) ──
    if (request.vendorCode) {
      const yCode = ensureSpace(doc.lastAutoTable.finalY + 20, 24)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(17, 17, 17)
      doc.text('SAP Vendor Code: ', margin, yCode)
      const labelW = doc.getTextWidth('SAP Vendor Code: ')
      doc.setFont('courier', 'bold'); doc.setFontSize(13)
      doc.text(String(request.vendorCode), margin + labelW, yCode)
    }

    doc.save(`${formNo}-vendor-registration-form.pdf`)
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
            <FormRow no="2" label="Purchasing Organization" value={request.purchasingOrganization} />
            <FormRow no="3" label="Material Group"          value={request.materialGroup} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="4" label="Reason"     value={request.reason} />
            <FormRow no="5" label="GST Number" value={request.gstNumber} mono />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="6" label="PAN Card"    value={request.panCard} mono />
            <FormRow no="7" label="MSME Vendor" value={request.msmeCategory ? `Yes — ${request.msmeCategory}` : 'No'} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="8" label="Proposed By"     value={request.proposedBy} />
            <FormRow no="9" label="One-Time Vendor" value={request.isOneTimeVendor ? 'Yes' : 'No'} />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section B: Address ── */}
          <SectionHeader letter="B" title="Address Details" />
          <FormRow no="10" label="Street / Building / Plot" value={request.addressDetails} />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="11" label="Postal Code" value={request.postalCode} />
            <FormRow no="12" label="City"        value={request.city} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="13" label="Locality" value={request.locality} />
            <FormRow no="14" label="State"    value={request.state} />
          </div>
          <FormRow no="15" label="Country" value={request.country || 'India'} />

          <hr className="border-gray-200 my-4" />

          {/* ── Section C: Commercial Terms ── */}
          <SectionHeader letter="C" title="Commercial Terms" />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="16" label="Currency"      value={request.currency     || 'INR'} />
            <FormRow no="17" label="Payment Terms" value={request.paymentTerms} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="18" label="Incoterms"  value={request.incoterms} />
            <FormRow no="19" label="Yearly PVO" value={request.yearlyPvo} />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section D: Banking Details ── */}
          <SectionHeader letter="D" title="Banking Details" />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="20" label="Bank Name"   value={request.bankName} />
            <FormRow no="21" label="Branch Name" value={request.branchName} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="22" label="Bank Account Number" value={request.bankAccountNumber} mono />
            <FormRow no="23" label="IFSC Code"           value={request.ifscCode}          mono />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section E: Contact ── */}
          <SectionHeader letter="E" title="Contact Details" />
          <div className="grid grid-cols-2 gap-4">
            <FormRow no="24" label="Contact Person" value={request.contactPerson || request.contactInformation} />
            <FormRow no="25" label="Telephone"      value={request.telephone} />
            <FormRow no="26" label="Email ID"       value={request.email} />
          </div>

          <hr className="border-gray-200 my-4" />

          {/* ── Section F: Approval Record ── */}
          <SectionHeader letter="F" title="Approval Record" />
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

          {/* ── Section G: SAP Vendor Code ── */}
          <SectionHeader letter="G" title="SAP Vendor Code" />
          {request.vendorCode ? (
            <div className="grid grid-cols-2 gap-4">
              <FormRow no="26" label="Vendor Code (SAP)" value={request.vendorCode} mono />
              <FormRow no="27" label="Date Assigned"     value={fmtDateFull(request.vendorCodeAssignedAt)} />
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

const fmtDate     = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '—'
const fmtDateFull = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—'
const fmtDateShort= (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'
