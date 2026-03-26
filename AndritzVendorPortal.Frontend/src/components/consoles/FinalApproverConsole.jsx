import { useState } from 'react'
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/24/solid'
import { XMarkIcon, EyeIcon, CheckIcon, ClockIcon, ArchiveBoxIcon,
         UsersIcon, ArrowPathIcon, NoSymbolIcon, TrophyIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import VendorDatabase from '../VendorDatabase'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import ApprovalTimeline from '../shared/ApprovalTimeline'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import { useViewedRequests } from '../../hooks/useViewedRequests'
import { buildStats, buildMonthlyData } from '../../utils/statsUtils'

function buildMaterialData(requests) {
  const counts = {}
  requests.forEach(r => {
    const key = r.materialGroup?.trim() || 'Unspecified'
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))
}

const METRICS = [
  { label: 'Total Assigned', key: 'total',        icon: UsersIcon,       bg: 'bg-blue-50',    ic: 'text-blue-500',    text: 'text-blue-700'    },
  { label: 'In Progress',    key: 'pending',       icon: ClockIcon,       bg: 'bg-amber-50',   ic: 'text-amber-500',   text: 'text-amber-700'   },
  { label: 'Awaiting Me',    key: 'finalPending',  icon: CheckBadgeIcon,  bg: 'bg-indigo-50',  ic: 'text-indigo-500',  text: 'text-indigo-700'  },
  { label: 'Completed',      key: 'completed',     icon: CheckIcon,       bg: 'bg-emerald-50', ic: 'text-emerald-500', text: 'text-emerald-700' },
  { label: 'Rejected',       key: 'rejected',      icon: NoSymbolIcon,    bg: 'bg-red-50',     ic: 'text-red-500',     text: 'text-red-700'     },
  { label: 'Approval Rate',  key: 'approvalRate',  icon: TrophyIcon,      bg: 'bg-cyan-50',    ic: 'text-cyan-500',    text: 'text-cyan-700'    },
  { label: 'Re-edit Rate',   key: 'reEditRate',    icon: ArrowPathIcon,   bg: 'bg-orange-50',  ic: 'text-orange-500',  text: 'text-orange-700'  },
  { label: 'Rejection Rate', key: 'rejectionRate', icon: NoSymbolIcon,    bg: 'bg-rose-50',    ic: 'text-rose-500',    text: 'text-rose-700'    },
]

export default function FinalApproverConsole({ workflow, currentUser, activePage }) {
  const queue   = workflow.getPendingFor(currentUser.id)
  const history = workflow.getHistoryFor(currentUser.id)
  const stats   = buildStats(workflow.requests)

  const [reviewing, setReviewing]           = useState(null)
  const [vendorCode, setVendorCode]         = useState('')
  const [vendorCodeErr, setVendorCodeErr]   = useState('')
  const [rejectMode, setRejectMode]         = useState(false)
  const [rejectComment, setRejectComment]   = useState('')
  const [rejectError, setRejectError]       = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [toast, setToast]                   = useState(null)

  const isAuthorizedFinalApprover = currentUser?.email === 'pardeep.sharma@andritz.com'
  const { isNew, markViewed } = useViewedRequests(currentUser.id)

  const openReview = (req) => {
    markViewed(req)
    setReviewing(req)
    setVendorCode('')
    setVendorCodeErr('')
    setRejectMode(false)
    setRejectComment('')
    setRejectError('')
  }

  const handleComplete = async () => {
    const trimmed = vendorCode.trim()
    if (!trimmed)                    { setVendorCodeErr('SAP Vendor Code is required.'); return }
    if (!/^\d{1,10}$/.test(trimmed)) { setVendorCodeErr('Vendor code must be 1–10 digits only.'); return }
    const name = reviewing.vendorName
    const code = trimmed
    try {
      await workflow.complete(reviewing.id, code)
      setReviewing(null)
      setToast({ type: 'success', title: 'Vendor Registration Completed', body: `${name} has been approved and vendor code ${code} has been assigned.` })
    } catch (err) {
      const msg = err?.response?.data || 'Failed to complete request.'
      setVendorCodeErr(typeof msg === 'string' ? msg : 'Vendor code already in use or invalid.')
    }
  }

  const handleReject = async () => {
    if (!rejectComment.trim()) { setRejectError('A rejection reason is required.'); return }
    const name = reviewing.vendorName
    await workflow.reject(reviewing.id, rejectComment)
    setReviewing(null)
    setToast({ type: 'error', title: 'Request Rejected', body: `You rejected the vendor request for ${name}. The buyer will be notified to revise and resubmit.` })
  }

  const myStepFor = (req) => req.approvalSteps.find(s => s.approverUserId === currentUser.id)

  // ── Render ───────────────────────────────────────────────────────────────────

  if (workflow.loading && workflow.requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <svg className="animate-spin h-7 w-7 text-[#096fb3]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Dashboard ───────────────────────────────────────────────────────── */}
      {activePage === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {METRICS.map(({ label, key, icon: Icon, bg, ic, text }) => (
              <div key={key} className={`card px-3 py-3.5 flex flex-col items-center gap-1.5 ${bg} text-center`}>
                <Icon className={`h-5 w-5 ${ic} flex-shrink-0`} />
                <p className="text-xl font-bold text-gray-900 leading-none">{stats[key]}</p>
                <p className={`text-xs font-medium ${text} leading-tight`}>{label}</p>
              </div>
            ))}
          </div>

          {queue.length > 0 && (
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Awaiting Final Review</h3>
                <span className="text-xs text-gray-400">{queue.length} request{queue.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {queue.slice(0, 3).map(req => (
                  <div key={req.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{req.vendorName}</p>
                        {isNew(req) && (
                          <span className="text-xs bg-indigo-500 text-white font-bold px-2 py-0.5 rounded-full">NEW</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{req.city}, {req.locality}</p>
                    </div>
                    {isAuthorizedFinalApprover && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#096fb3] hover:bg-[#075d99] px-3 py-1.5 text-xs font-semibold text-white transition-colors flex-shrink-0"
                        onClick={() => openReview(req)}
                      >
                        <StarIcon className="h-3.5 w-3.5" />
                        Final Review
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {queue.length === 0 && (
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-12 text-center">
              <CheckBadgeIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No requests awaiting your approval.</p>
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Monthly requests chart */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Requests — Last 6 Months</h3>
              </div>
              <div className="px-2 py-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={buildMonthlyData(workflow.requests)} barSize={24} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#eef2ff' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Material group chart */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Requests by Material Group</h3>
              </div>
              <div className="px-2 py-4">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={buildMaterialData(workflow.requests)} layout="vertical" barSize={14} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Queue ───────────────────────────────────────────────────── */}
      {activePage === 'pending' && (
        <div className="space-y-4">
          {queue.length === 0 && (
            <div className="card p-12 text-center">
              <CheckBadgeIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No requests awaiting your approval.</p>
            </div>
          )}
          {queue.map(req => {
            const intermediateSteps = req.approvalSteps.filter(s => !s.isFinalApproval)
            const allIntermediate   = intermediateSteps.every(s => s.decision === 'Approved')
            return (
              <div key={req.id} className="card overflow-hidden">
                <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-3">
                  <CheckBadgeIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-800 font-medium">
                    {allIntermediate
                      ? `All ${intermediateSteps.length} intermediate approval${intermediateSteps.length !== 1 ? 's' : ''} completed`
                      : 'Some intermediate approvals still pending'}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                        {req.revisionNo > 0 && (
                          <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                        )}
                        {isNew(req) && (
                          <span className="text-xs bg-indigo-500 text-white font-bold px-2 py-0.5 rounded-full">NEW</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{req.addressDetails} · {req.city}, {req.locality}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button className="btn-secondary" onClick={() => { markViewed(req); setViewingRequest(req) }}>
                        <EyeIcon className="h-4 w-4" />
                        View
                      </button>
                      {isAuthorizedFinalApprover && (
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#096fb3] hover:bg-[#075d99] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
                          onClick={() => openReview(req)}
                        >
                          <StarIcon className="h-4 w-4" />
                          Final Review
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2">
                    <span className="text-xs text-amber-700 font-medium">Awaiting SAP Vendor Code entry.</span>
                    <span className="text-xs text-amber-500">Click "Final Review" to enter the code and complete.</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── History ─────────────────────────────────────────────────────────── */}
      {activePage === 'history' && (
        <div className="space-y-4">
          {history.length === 0 && (
            <div className="card p-12 text-center">
              <ArchiveBoxIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No vendor registrations acted upon yet.</p>
            </div>
          )}
          {history.map(req => {
            const step       = myStepFor(req)
            const isApproved = step?.decision === 'Approved'
            return (
              <div key={req.id} className="card px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                      <StatusBadge status={req.status} />
                      {req.revisionNo > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset ${
                        isApproved ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
                      }`}>
                        {isApproved ? <CheckIcon className="h-3 w-3" /> : <XMarkIcon className="h-3 w-3" />}
                        Final {isApproved ? 'approved' : 'rejected'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{req.addressDetails} · {req.city}, {req.locality}</p>
                    {req.vendorCode && <p className="text-xs text-emerald-600 font-mono mt-1">Vendor Code: {req.vendorCode}</p>}
                    {step?.comment && <p className="text-xs text-gray-500 mt-1 italic">Comment: "{step.comment}"</p>}
                    {step?.decidedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Decided {new Date(step.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    )}
                  </div>
                  <button className="btn-secondary flex-shrink-0" onClick={() => setViewingRequest(req)}>
                    <EyeIcon className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Vendor Database ─────────────────────────────────────────────────── */}
      {activePage === 'vendors' && (
        <VendorDatabase requests={workflow.requests} isAdmin={false} />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {reviewing && (
        <Modal title={`Final Review — ${reviewing.vendorName}`} onClose={() => setReviewing(null)} size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Information</h3>
              <Field label="Vendor Name" value={reviewing.vendorName} />
              <Field label="Contact"     value={reviewing.contactInformation} />
              <Field label="Address"     value={reviewing.addressDetails} />
              <Field label="City"        value={reviewing.city} />
              <Field label="Locality"    value={reviewing.locality} />
              {reviewing.revisionNo > 0 && <Field label="Revision" value={`REV ${reviewing.revisionNo}`} />}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Approval Chain</h3>
              <ApprovalTimeline steps={reviewing.approvalSteps} />
            </div>
          </div>

          {!rejectMode ? (
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">Enter SAP Vendor Code</p>
                <p className="text-xs text-amber-700">
                  Retrieve the code from SAP after final approval. Once submitted, the workflow will be marked <strong>Completed</strong>.
                </p>
              </div>
              <div>
                <label className="form-label">SAP Vendor Code <span className="text-red-500">*</span></label>
                <input
                  className="form-input font-mono text-base tracking-widest"
                  placeholder="e.g. 1234567890 (1–10 digits)"
                  value={vendorCode}
                  onChange={e => { setVendorCode(e.target.value); setVendorCodeErr('') }}
                  autoFocus
                />
                {vendorCodeErr && <p className="mt-1 text-xs text-red-600">{vendorCodeErr}</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-danger" disabled={workflow.actionLoading} onClick={() => setRejectMode(true)}>
                  <XMarkIcon className="h-4 w-4" />
                  Reject
                </button>
                {isAuthorizedFinalApprover && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#096fb3] hover:bg-[#075d99] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
                    disabled={workflow.actionLoading}
                    onClick={handleComplete}
                  >
                    <CheckBadgeIcon className="h-4 w-4" />
                    {workflow.actionLoading ? 'Saving…' : 'Approve & Assign Vendor Code'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">Reject at Final Stage</p>
                <p className="text-xs text-red-600">The Buyer will be notified and must correct and resubmit.</p>
              </div>
              <div>
                <label className="form-label">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea className="form-input resize-none" rows={3} placeholder="Describe the issue..."
                  value={rejectComment} onChange={e => { setRejectComment(e.target.value); setRejectError('') }} />
                {rejectError && <p className="mt-1 text-xs text-red-600">{rejectError}</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" disabled={workflow.actionLoading} onClick={() => setRejectMode(false)}>Back</button>
                <button className="btn-danger disabled:opacity-60" disabled={workflow.actionLoading} onClick={handleReject}>
                  <XMarkIcon className="h-4 w-4" />
                  {workflow.actionLoading ? 'Saving…' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {toast && <Toast type={toast.type} title={toast.title} body={toast.body} onClose={() => setToast(null)} />}
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 font-medium mt-0.5">{value}</dd>
    </div>
  )
}
