import { useState } from 'react'
import { CheckIcon, XMarkIcon, EyeIcon, ClockIcon, ArchiveBoxIcon,
         ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import ApprovalTimeline from '../shared/ApprovalTimeline'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import { useViewedRequests } from '../../hooks/useViewedRequests'
import { buildMonthlyData } from '../../utils/statsUtils'

export default function ApproverConsole({ workflow, currentUser, activePage, onNavigate }) {
  const pending         = workflow.getPendingFor(currentUser.id)
  const allActedOn      = workflow.getHistoryFor(currentUser.id)

  const history = allActedOn.filter(r =>
    r.approvalSteps.some(s => s.approverUserId === currentUser.id && s.decision === 'Approved') &&
    !r.approvalSteps.some(s => s.approverUserId === currentUser.id && s.decision === 'Rejected')
  )
  const waitingRevision = allActedOn.filter(r =>
    r.approvalSteps.some(s => s.approverUserId === currentUser.id && s.decision === 'Rejected') &&
    r.status === 'Rejected'
  )

  const [reviewing, setReviewing]           = useState(null)
  const [rejectMode, setRejectMode]         = useState(false)
  const [approveComment, setApproveComment] = useState('')
  const [rejectComment, setRejectComment]   = useState('')
  const [rejectError, setRejectError]       = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [toast, setToast]                   = useState(null)

  const { isNew, markViewed } = useViewedRequests(currentUser.id)

  const openReview = (req) => {
    markViewed(req)
    setReviewing(req)
    setRejectMode(false)
    setApproveComment('')
    setRejectComment('')
    setRejectError('')
  }

  const openView = (req) => {
    markViewed(req)
    setViewingRequest(req)
  }

  const handleApprove = async () => {
    const name = reviewing.vendorName
    try {
      await workflow.approveStep(reviewing.id, approveComment)
      setReviewing(null)
      setToast({ type: 'success', title: 'Request Approved', body: `You approved the vendor request for ${name}. It has moved to the next step.` })
    } catch (err) {
      setToast({ type: 'error', title: 'Action Failed', body: err?.response?.data?.message ?? err?.response?.data ?? 'Failed to approve request. Please try again.' })
    }
  }

  const handleReject = async () => {
    if (!rejectComment.trim()) { setRejectError('A comment is required when rejecting.'); return }
    const name = reviewing.vendorName
    try {
      await workflow.reject(reviewing.id, rejectComment)
      setReviewing(null)
      setToast({ type: 'warning', title: 'Request Rejected', body: `You rejected the vendor request for ${name}. The buyer will be notified to revise and resubmit.` })
    } catch (err) {
      setToast({ type: 'error', title: 'Action Failed', body: err?.response?.data?.message ?? err?.response?.data ?? 'Failed to reject request. Please try again.' })
    }
  }

  const myStepFor = (req) => req.approvalSteps.find(s => s.approverUserId === currentUser.id)

  // ── Render ───────────────────────────────────────────────────────────────────

  if (workflow.loading && workflow.requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-[#096fb3] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Dashboard ───────────────────────────────────────────────────────── */}
      {activePage === 'dashboard' && (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => onNavigate?.('pending')}
              className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <ClockIcon className="h-5 w-5 text-[#096fb3]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pending.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Pending Review</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('waiting')}
              className={`bg-white rounded-xl ring-1 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left ${waitingRevision.length > 0 ? 'ring-amber-200' : 'ring-gray-200'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${waitingRevision.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <ExclamationCircleIcon className={`h-5 w-5 ${waitingRevision.length > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{waitingRevision.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Awaiting Buyer Revision</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('history')}
              className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-center gap-4 hover:ring-2 hover:ring-slate-600 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <CheckIcon className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{history.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Approved</p>
              </div>
            </button>
          </div>

          {/* Monthly approvals chart */}
          <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">My Approvals — Last 6 Months</h3>
            </div>
            <div className="px-2 py-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={buildMonthlyData(history, 'updatedAt')} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#f0fdf4' }}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v) => [v, 'Approvals']}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent pending */}
          {pending.length > 0 && (
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Pending Your Review</h3>
                <span className="text-xs text-gray-400">{pending.length} request{pending.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {pending.slice(0, 3).map(req => (
                  <div key={req.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{req.vendorName}</p>
                        {isNew(req) && (
                          <span className="text-xs bg-violet-500 text-white font-bold px-2 py-0.5 rounded-full">NEW</span>
                        )}
                        {req.revisionNo > 0 && (
                          <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Submitted by {req.createdByName} · {new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#096fb3] hover:bg-[#075d99] px-3 py-1.5 text-xs font-semibold text-white transition-colors flex-shrink-0"
                      onClick={() => openReview(req)}
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length === 0 && (
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-12 text-center">
              <CheckIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">All caught up — no requests pending your review.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Pending Approval ────────────────────────────────────────────────── */}
      {activePage === 'pending' && (
        <div className="space-y-4">
          {pending.length === 0 && (
            <div className="card p-12 text-center">
              <CheckIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">All caught up — no requests pending your review.</p>
            </div>
          )}
          {pending.map(req => (
            <div key={req.id} className="card px-5 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                    {req.revisionNo > 0 && (
                      <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                    )}
                    {isNew(req) && (
                      <span className="text-xs bg-violet-500 text-white font-bold px-2 py-0.5 rounded-full">NEW</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{req.addressDetails} · {req.city}, {req.locality}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Submitted by <span className="font-medium text-gray-600">{req.createdByName}</span>
                    {' · '}{new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="btn-secondary" onClick={() => openView(req)}>
                    <EyeIcon className="h-4 w-4" />
                    View
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#096fb3] hover:bg-[#075d99] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors"
                    onClick={() => openReview(req)}
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Waiting Revision ────────────────────────────────────────────────── */}
      {activePage === 'waiting' && (
        <div className="space-y-4">
          {waitingRevision.length === 0 && (
            <div className="card p-12 text-center">
              <ExclamationCircleIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No rejected requests waiting for buyer revision.</p>
            </div>
          )}
          {waitingRevision.map(req => {
            const step = myStepFor(req)
            return (
              <div key={req.id} className="card overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center gap-2">
                  <ExclamationCircleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">You rejected this request — awaiting buyer revision and resubmission</p>
                </div>
                <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                    {step?.comment && <p className="text-xs text-gray-500 mt-1 italic">Your rejection reason: "{step.comment}"</p>}
                    <p className="text-xs text-gray-400 mt-0.5">Submitted by <span className="font-medium text-gray-600">{req.createdByName}</span></p>
                  </div>
                  <button className="btn-secondary flex-shrink-0" onClick={() => openView(req)}>
                    <EyeIcon className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── History ─────────────────────────────────────────────────────────── */}
      {activePage === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-2 select-none">
              <CheckIcon className="h-4 w-4" />
              {history.length} Approved
            </span>
          </div>
          {history.length === 0 && (
            <div className="card p-12 text-center">
              <ArchiveBoxIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No requests approved yet.</p>
            </div>
          )}
          {history.map(req => {
            const step = myStepFor(req)
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
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                        <CheckIcon className="h-3 w-3" />
                        You approved
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                    {step?.comment && <p className="text-xs text-gray-500 mt-1 italic">Your comment: "{step.comment}"</p>}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted by <span className="font-medium text-gray-600">{req.createdByName}</span>
                      {step?.decidedAt && <> · Decided {new Date(step.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</>}
                    </p>
                  </div>
                  <button className="btn-secondary flex-shrink-0" onClick={() => openView(req)}>
                    <EyeIcon className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {reviewing && (
        <Modal title={`Review — ${reviewing.vendorName}`} onClose={() => setReviewing(null)} size="lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Information</h3>
              <InfoField label="Vendor Name" value={reviewing.vendorName} />
              <InfoField label="Contact"     value={reviewing.contactInformation} />
              <InfoField label="Address"     value={reviewing.addressDetails} />
              <InfoField label="City"        value={reviewing.city} />
              <InfoField label="Locality"    value={reviewing.locality} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Approval Chain</h3>
              <ApprovalTimeline steps={reviewing.approvalSteps} />
            </div>
          </div>

          {!rejectMode ? (
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div>
                <label className="form-label">Comment (optional)</label>
                <textarea className="form-input resize-none" rows={2} placeholder="Add an approval note..."
                  value={approveComment} onChange={e => setApproveComment(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-danger" disabled={workflow.actionLoading} onClick={() => setRejectMode(true)}>
                  <XMarkIcon className="h-4 w-4" />
                  Reject
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#096fb3] hover:bg-[#075d99] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
                  disabled={workflow.actionLoading}
                  onClick={handleApprove}
                >
                  <CheckIcon className="h-4 w-4" />
                  {workflow.actionLoading ? 'Saving…' : 'Approve'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-4">
                <p className="text-sm font-semibold text-red-800 mb-1">Reject Request</p>
                <p className="text-xs text-red-600">The Buyer will be notified and must update and resubmit.</p>
              </div>
              <div>
                <label className="form-label">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea className="form-input resize-none" rows={3} placeholder="Describe what needs to be corrected..."
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

function InfoField({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 font-medium">{value}</dd>
    </div>
  )
}
