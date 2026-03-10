import { useState } from 'react'
import {
  DocumentTextIcon, ClockIcon, PrinterIcon,
  CheckCircleIcon, XCircleIcon, ArrowRightIcon,
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

export default function VendorDetailModal({ request, onClose }) {
  const [activeTab, setActiveTab] = useState('details')

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
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Section title="Vendor Information">
          <Field label="Vendor Name"    value={request.vendorName} />
          {request.materialGroup && <Field label="Material Group" value={request.materialGroup} />}
          {request.reason        && <Field label="Reason"         value={request.reason} />}
          <Field label="GST Number"     value={request.gstNumber || '—'} mono />
          <Field label="PAN Card"       value={request.panCard   || '—'} mono />
        </Section>

        <Section title="Address">
          <Field label="Street / Building" value={request.addressDetails} />
          <Field
            label="City / Locality"
            value={[request.city, request.locality, request.state, request.postalCode].filter(Boolean).join(', ')}
          />
          <Field label="Country" value={request.country || 'India'} />
        </Section>

        <Section title="Commercial Terms">
          <Field label="Currency"      value={request.currency     || 'INR'} />
          {request.paymentTerms && <Field label="Payment Terms" value={request.paymentTerms} />}
          {request.incoterms    && <Field label="Incoterms"     value={request.incoterms} />}
          {request.yearlyPvo    && <Field label="Yearly PVO"    value={request.yearlyPvo} />}
        </Section>

        <Section title="Contact">
          <Field label="Contact Person" value={contact || '—'} />
          {request.telephone && <Field label="Telephone" value={request.telephone} />}
        </Section>

        <Section title="Submission">
          <Field label="Submitted By"  value={request.createdByName} />
          <Field label="Created"       value={fmtDate(request.createdAt)} />
          <Field label="Last Updated"  value={fmtDate(request.updatedAt)} />
        </Section>

        {request.vendorCode && (
          <Section title="SAP Vendor Code" accent="emerald">
            <div className="flex items-center gap-3 py-2">
              <CheckBadgeIcon className="h-7 w-7 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="font-mono text-lg font-bold text-emerald-700 tracking-widest">
                  {request.vendorCode}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Assigned by Pardeep Sharma · {fmtDate(request.vendorCodeAssignedAt)}
                </p>
              </div>
            </div>
          </Section>
        )}

        {request.rejectionComment && (
          <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-4">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Rejection Reason</p>
            <p className="text-sm text-red-800">"{request.rejectionComment}"</p>
          </div>
        )}
      </div>

      <div>
        <Section title="Approval Chain">
          <ApprovalTimeline steps={request.approvalSteps} />
        </Section>
      </div>
    </div>
  )
}

// ── Tab: Revision History (BRD §5) ───────────────────────────────────────────

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

            {/* Why it was rejected before this resubmit */}
            {entry.rejectionComment && (
              <div className="mt-2 rounded-md bg-red-50 ring-1 ring-red-100 px-3 py-2">
                <p className="text-xs text-red-500 font-medium">Rejected because:</p>
                <p className="text-xs text-red-700 mt-0.5 italic">"{entry.rejectionComment}"</p>
              </div>
            )}

            {/* Field-level diff */}
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
  const sorted = [...request.approvalSteps].sort((a, b) => a.stepOrder - b.stepOrder)
  const formNo = `VRF-${String(request.id).padStart(4, '0')}`

  return (
    <div className="overflow-x-auto">
      {/* Paper document */}
      <div
        className="mx-auto bg-white border border-gray-300 shadow-md font-serif text-gray-900 min-w-[480px]"
        style={{ width: '680px', padding: '40px 48px' }}
      >
        {/* ── Company Header ── */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="h-8 w-1.5 bg-[#c8102e]" />
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

        <hr className="border-gray-200 my-4" />

        {/* ── Section B: Address ── */}
        <SectionHeader letter="B" title="Address Details" />
        <FormRow no="6" label="Street / Building / Plot" value={request.addressDetails} />
        <div className="grid grid-cols-2 gap-4">
          <FormRow no="7" label="Postal Code" value={request.postalCode} />
          <FormRow no="8" label="City"        value={request.city} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormRow no="9"  label="Locality" value={request.locality} />
          <FormRow no="10" label="State"    value={request.state} />
        </div>
        <FormRow no="11" label="Country" value={request.country || 'India'} />

        <hr className="border-gray-200 my-4" />

        {/* ── Section C: Commercial Terms ── */}
        <SectionHeader letter="C" title="Commercial Terms" />
        <div className="grid grid-cols-2 gap-4">
          <FormRow no="12" label="Currency"      value={request.currency     || 'INR'} />
          <FormRow no="13" label="Payment Terms" value={request.paymentTerms} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormRow no="14" label="Incoterms"  value={request.incoterms} />
          <FormRow no="15" label="Yearly PVO" value={request.yearlyPvo} />
        </div>

        <hr className="border-gray-200 my-4" />

        {/* ── Section D: Contact ── */}
        <SectionHeader letter="D" title="Contact Details" />
        <div className="grid grid-cols-2 gap-4">
          <FormRow no="16" label="Contact Person" value={request.contactPerson || request.contactInformation} />
          <FormRow no="17" label="Telephone"      value={request.telephone} />
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
            <FormRow no="18" label="Vendor Code (SAP)" value={request.vendorCode} mono />
            <FormRow no="19" label="Date Assigned"     value={fmtDateFull(request.vendorCodeAssignedAt)} />
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
  )
}

// ── Small sub-components ──────────────────────────────────────────────────────

function Section({ title, children, accent = 'gray' }) {
  const colors = { gray: 'text-gray-500', emerald: 'text-emerald-600' }
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${colors[accent]}`}>{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className={`text-sm font-medium mt-0.5 break-words ${mono ? 'font-mono tracking-wider text-gray-700' : 'text-gray-800'}`}>{value}</dd>
    </div>
  )
}

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
