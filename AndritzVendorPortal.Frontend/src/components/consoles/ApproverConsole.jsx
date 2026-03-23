import { useState, useCallback } from 'react'
import { CheckIcon, XMarkIcon, EyeIcon, ClockIcon, ArchiveBoxIcon,
         ExclamationCircleIcon } from '@heroicons/react/24/outline'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import ApprovalTimeline from '../shared/ApprovalTimeline'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import NotificationBell from '../shared/NotificationBell'
import { useNotifications } from '../../hooks/useNotifications'

// Tracks which pending request IDs the approver has already opened.
// "New" badge disappears once a request has been viewed.
function useViewedRequests(userId) {
  const key = `viewed_reqs_${userId}`
  const load = () => {
    try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')) }
    catch { return new Set() }
  }
  const [viewed, setViewed] = useState(load)
  const markViewed = useCallback((id) => {
    setViewed(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem(key, JSON.stringify([...next]))
      return next
    })
  }, [key])
  const isNew = useCallback((id) => !viewed.has(id), [viewed])
  return { isNew, markViewed }
}

const TABS = [
  { id: 'pending', label: 'Pending',          icon: ClockIcon             },
  { id: 'waiting', label: 'Waiting Revision',  icon: ExclamationCircleIcon },
  { id: 'history', label: 'History',           icon: ArchiveBoxIcon        },
]

export default function ApproverConsole({ workflow, currentUser }) {
  const pending    = workflow.getPendingFor(currentUser.id)
  const allActedOn = workflow.getHistoryFor(currentUser.id)

  // History = only the requests this approver approved (not rejected)
  const history = allActedOn.filter(r =>
    r.approvalSteps.some(s => s.approverUserId === currentUser.id && s.decision === 'Approved') &&
    !r.approvalSteps.some(s => s.approverUserId === currentUser.id && s.decision === 'Rejected')
  )
  // Waiting Revision = this approver rejected AND buyer hasn't resubmitted yet
  const waitingRevision = allActedOn.filter(r =>
    r.approvalSteps.some(s => s.approverUserId === currentUser.id && s.decision === 'Rejected') &&
    r.status === 'Rejected'
  )

  const [activeTab, setActiveTab]           = useState('pending')
  const [reviewing, setReviewing]           = useState(null)
  const [rejectMode, setRejectMode]         = useState(false)
  const [approveComment, setApproveComment] = useState('')
  const [rejectComment, setRejectComment]   = useState('')
  const [rejectError, setRejectError]       = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [toast, setToast]                   = useState(null)

  const { isNew, markViewed } = useViewedRequests(currentUser.id)
  const { notifications, unreadCount, markAllRead } = useNotifications(
    workflow.requests, currentUser.id, 'Approver'
  )

  const openReview = (req) => {
    markViewed(req.id)
    setReviewing(req)
    setRejectMode(false)
    setApproveComment('')
    setRejectComment('')
    setRejectError('')
  }

  const openView = (req) => {
    markViewed(req.id)
    setViewingRequest(req)
  }

  const handleApprove = async () => {
    const name = reviewing.vendorName
    await workflow.approveStep(reviewing.id, approveComment)
    setReviewing(null)
    setToast({
      type: 'success',
      title: 'Request Approved',
      body: `You approved the vendor request for ${name}. It has moved to the next step.`,
    })
  }

  const handleReject = () => {
    if (!rejectComment.trim()) { setRejectError('A comment is required when rejecting.'); return }
    workflow.reject(reviewing.id, rejectComment)
    setReviewing(null)
  }

  const myStepFor = (req) =>
    req.approvalSteps.find(s => s.approverUserId === currentUser.id)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approver Console</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length} pending · {history.length} approved · {waitingRevision.length} waiting revision
          </p>
        </div>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          label="Notifications"
        />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = id === 'pending' ? pending.length : id === 'waiting' ? waitingRevision.length : history.length
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Pending tab ─────────────────────────────────────────────────── */}
      {activeTab === 'pending' && (
        <>
          {pending.length === 0 && (
            <div className="card p-12 text-center">
              <CheckIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">All caught up — no requests pending your review.</p>
            </div>
          )}
          <div className="space-y-4">
            {pending.map(req => (
              <div key={req.id} className="card px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                      <StatusBadge status={req.status} />
                      {req.revisionNo > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">
                          REV {req.revisionNo}
                        </span>
                      )}
                      {isNew(req.id) && (
                        <span className="text-xs bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {req.addressDetails} · {req.city}, {req.locality}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted by <span className="font-medium text-gray-600">{req.createdByName}</span>
                      {' '} · {new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="btn-secondary" onClick={() => openView(req)}>
                      <EyeIcon className="h-4 w-4" />
                      View
                    </button>
                    <button className="btn-primary" onClick={() => openReview(req)}>
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Waiting Revision tab ─────────────────────────────────────────── */}
      {activeTab === 'waiting' && (
        <>
          {waitingRevision.length === 0 && (
            <div className="card p-12 text-center">
              <ExclamationCircleIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No rejected requests waiting for buyer revision.</p>
            </div>
          )}
          <div className="space-y-4">
            {waitingRevision.map(req => {
              const step = myStepFor(req)
              return (
                <div key={req.id} className="card overflow-hidden">
                  <div className="bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center gap-2">
                    <ExclamationCircleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      You rejected this request — awaiting buyer revision and resubmission
                    </p>
                  </div>
                  <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-gray-900">{req.vendorName}</h2>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                      {step?.comment && (
                        <p className="text-xs text-gray-500 mt-1 italic">Your rejection reason: "{step.comment}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Submitted by <span className="font-medium text-gray-600">{req.createdByName}</span>
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
        </>
      )}

      {/* ── History tab ─────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <>
          {history.length === 0 && (
            <div className="card p-12 text-center">
              <ArchiveBoxIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No requests approved yet.</p>
            </div>
          )}
          <div className="space-y-4">
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
                          <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">
                            REV {req.revisionNo}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                          <CheckIcon className="h-3 w-3" />
                          You approved
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{req.contactInformation}</p>
                      {step?.comment && (
                        <p className="text-xs text-gray-500 mt-1 italic">Your comment: "{step.comment}"</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        Submitted by <span className="font-medium text-gray-600">{req.createdByName}</span>
                        {step?.decidedAt && (
                          <> · Decided {new Date(step.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</>
                        )}
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
        </>
      )}

      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {/* Review Modal */}
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
                <textarea
                  className="form-input resize-none"
                  rows={2}
                  placeholder="Add an approval note..."
                  value={approveComment}
                  onChange={e => setApproveComment(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-danger" onClick={() => setRejectMode(true)}>
                  <XMarkIcon className="h-4 w-4" />
                  Reject
                </button>
                <button className="btn-success" onClick={handleApprove}>
                  <CheckIcon className="h-4 w-4" />
                  Approve
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
                <textarea
                  className="form-input resize-none"
                  rows={3}
                  placeholder="Describe what needs to be corrected..."
                  value={rejectComment}
                  onChange={e => { setRejectComment(e.target.value); setRejectError('') }}
                />
                {rejectError && <p className="mt-1 text-xs text-red-600">{rejectError}</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setRejectMode(false)}>Back</button>
                <button className="btn-danger" onClick={handleReject}>
                  <XMarkIcon className="h-4 w-4" />
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {toast && (
        <Toast
          type={toast.type}
          title={toast.title}
          body={toast.body}
          onClose={() => setToast(null)}
        />
      )}
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
