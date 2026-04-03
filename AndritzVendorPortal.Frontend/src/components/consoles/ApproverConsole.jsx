import { useState } from 'react'
import { CheckIcon, XMarkIcon, EyeIcon, ClockIcon, ArchiveBoxIcon,
         ExclamationCircleIcon, ChevronLeftIcon, ChevronRightIcon,
         MagnifyingGlassIcon } from '@heroicons/react/24/outline'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import ApprovalTimeline from '../shared/ApprovalTimeline'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import PageSizeSelect from '../shared/PageSizeSelect'
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
  const [pageSize, setPageSize]             = useState(10)
  const [pendingPage, setPendingPage]       = useState(1)
  const [waitingPage, setWaitingPage]       = useState(1)
  const [historyPage, setHistoryPage]       = useState(1)
  const [pendingSearch, setPendingSearch]   = useState('')
  const [waitingSearch, setWaitingSearch]   = useState('')
  const [historySearch, setHistorySearch]   = useState('')
  const [pendingDateFrom, setPendingDateFrom] = useState('')
  const [pendingDateTo, setPendingDateTo]     = useState('')
  const [waitingDateFrom, setWaitingDateFrom] = useState('')
  const [waitingDateTo, setWaitingDateTo]     = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo]     = useState('')

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

  const matchesSearch = (req, q) => {
    if (!q.trim()) return true
    const lq = q.toLowerCase()
    return (
      req.vendorName?.toLowerCase().includes(lq) ||
      req.contactInformation?.toLowerCase().includes(lq) ||
      req.city?.toLowerCase().includes(lq) ||
      req.locality?.toLowerCase().includes(lq) ||
      req.createdByName?.toLowerCase().includes(lq)
    )
  }

  const matchesDateRange = (req, dateFrom, dateTo) => {
    if (!dateFrom && !dateTo) return true
    const d = new Date(req.createdAt)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (workflow.loading && workflow.requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-[#096fb3] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">

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
                <p className="text-xs text-gray-500 mt-0.5">Pending Approval</p>
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

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Requests Pipeline */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Requests Pipeline</h3>
              </div>
              <div className="px-2 py-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={buildMonthlyData([...pending, ...allActedOn], 'createdAt', 3)} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#eef2ff' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Approved Requests */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Approved Requests</h3>
              </div>
              <div className="px-2 py-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={buildMonthlyData(history, 'updatedAt', 3)} barSize={28} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f0fdf4' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Approvals']} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
      {activePage === 'pending' && (() => {
        const filtered   = pending.filter(r => matchesSearch(r, pendingSearch) && matchesDateRange(r, pendingDateFrom, pendingDateTo))
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
        const paginated  = filtered.slice((pendingPage - 1) * pageSize, pendingPage * pageSize)
        return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search by vendor, city…" value={pendingSearch}
                onChange={e => { setPendingSearch(e.target.value); setPendingPage(1) }}
                className="form-input pl-9 text-sm w-48" />
            </div>
            <input type="date" value={pendingDateFrom} onChange={e => { setPendingDateFrom(e.target.value); setPendingPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="From date" />
            <input type="date" value={pendingDateTo} onChange={e => { setPendingDateTo(e.target.value); setPendingPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="To date" />
          </div>
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{pendingSearch || pendingDateFrom || pendingDateTo ? 'No results match the filters.' : 'All caught up — no requests pending your review.'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 shadow-sm">
              <div className="overflow-x-auto rounded-t-xl">
              <table className="min-w-full w-max text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Serial No.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Submitted On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map((req, idx) => {
                    const serial = (pendingPage - 1) * pageSize + idx + 1
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{serial}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{req.vendorName}</p>
                            {req.revisionNo > 0 && <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>}
                            {isNew(req) && <span className="text-xs bg-violet-500 text-white font-bold px-2 py-0.5 rounded-full">NEW</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{req.contactInformation}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{req.createdByName}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{[req.city, req.locality].filter(Boolean).join(', ')}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => openView(req)}>
                              <EyeIcon className="h-3.5 w-3.5" />View
                            </button>
                            <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white bg-[#096fb3] hover:bg-[#075d99] transition-colors" onClick={() => openReview(req)}>
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Showing {filtered.length === 0 ? 0 : (pendingPage - 1) * pageSize + 1}–{Math.min(pendingPage * pageSize, filtered.length)} of {filtered.length}</span>
                  <PageSizeSelect value={pageSize} onChange={v => { setPageSize(v); setPendingPage(1) }} />
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={pendingPage === 1} onClick={() => setPendingPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
                    <span className="text-xs text-gray-500 px-1">Page {pendingPage} of {totalPages}</span>
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={pendingPage === totalPages} onClick={() => setPendingPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── Waiting Revision ────────────────────────────────────────────────── */}
      {activePage === 'waiting' && (() => {
        const filtered   = waitingRevision.filter(r => matchesSearch(r, waitingSearch) && matchesDateRange(r, waitingDateFrom, waitingDateTo))
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
        const paginated  = filtered.slice((waitingPage - 1) * pageSize, waitingPage * pageSize)
        return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search by vendor, city…" value={waitingSearch}
                onChange={e => { setWaitingSearch(e.target.value); setWaitingPage(1) }}
                className="form-input pl-9 text-sm w-48" />
            </div>
            <input type="date" value={waitingDateFrom} onChange={e => { setWaitingDateFrom(e.target.value); setWaitingPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="From date" />
            <input type="date" value={waitingDateTo} onChange={e => { setWaitingDateTo(e.target.value); setWaitingPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="To date" />
          </div>
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <ExclamationCircleIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{waitingSearch || waitingDateFrom || waitingDateTo ? 'No results match the filters.' : 'No rejected requests waiting for buyer revision.'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 shadow-sm">
              <div className="overflow-x-auto rounded-t-xl">
              <table className="min-w-full w-max text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Serial No.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejection Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Rejected On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map((req, idx) => {
                    const step   = myStepFor(req)
                    const serial = (waitingPage - 1) * pageSize + idx + 1
                    return (
                      <tr key={req.id} className="hover:bg-amber-50/30 transition-colors divide-x divide-gray-200">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{serial}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{req.vendorName}</p>
                            {req.revisionNo > 0 && <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{req.contactInformation}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-red-600 italic max-w-xs truncate">{step?.comment || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{req.createdByName}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {step?.decidedAt ? new Date(step.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => openView(req)}>
                            <EyeIcon className="h-3.5 w-3.5" />View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Showing {filtered.length === 0 ? 0 : (waitingPage - 1) * pageSize + 1}–{Math.min(waitingPage * pageSize, filtered.length)} of {filtered.length}</span>
                  <PageSizeSelect value={pageSize} onChange={v => { setPageSize(v); setWaitingPage(1) }} />
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={waitingPage === 1} onClick={() => setWaitingPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
                    <span className="text-xs text-gray-500 px-1">Page {waitingPage} of {totalPages}</span>
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={waitingPage === totalPages} onClick={() => setWaitingPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── History ─────────────────────────────────────────────────────────── */}
      {activePage === 'history' && (() => {
        const filtered   = history.filter(r => matchesSearch(r, historySearch) && matchesDateRange(r, historyDateFrom, historyDateTo))
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
        const paginated  = filtered.slice((historyPage - 1) * pageSize, historyPage * pageSize)
        return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-2 select-none shrink-0 whitespace-nowrap">
              <CheckIcon className="h-4 w-4" />
              {filtered.length} Approved
            </span>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search by vendor, city…" value={historySearch}
                onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1) }}
                className="form-input pl-9 text-sm w-48" />
            </div>
            <input type="date" value={historyDateFrom} onChange={e => { setHistoryDateFrom(e.target.value); setHistoryPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="From date" />
            <input type="date" value={historyDateTo} onChange={e => { setHistoryDateTo(e.target.value); setHistoryPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="To date" />
          </div>
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <ArchiveBoxIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{historySearch || historyDateFrom || historyDateTo ? 'No results match the filters.' : 'No requests approved yet.'}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 shadow-sm">
              <div className="overflow-x-auto rounded-t-xl">
              <table className="min-w-full w-max text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">Serial No.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Comment</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Decided On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map((req, idx) => {
                    const step   = myStepFor(req)
                    const serial = (historyPage - 1) * pageSize + idx + 1
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{serial}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{req.vendorName}</p>
                            {req.revisionNo > 0 && <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{req.contactInformation}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{req.createdByName}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 italic max-w-xs truncate">{step?.comment || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {step?.decidedAt ? new Date(step.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => openView(req)}>
                            <EyeIcon className="h-3.5 w-3.5" />View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Showing {filtered.length === 0 ? 0 : (historyPage - 1) * pageSize + 1}–{Math.min(historyPage * pageSize, filtered.length)} of {filtered.length}</span>
                  <PageSizeSelect value={pageSize} onChange={v => { setPageSize(v); setHistoryPage(1) }} />
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
                    <span className="text-xs text-gray-500 px-1">Page {historyPage} of {totalPages}</span>
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={historyPage === totalPages} onClick={() => setHistoryPage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )
      })()}

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
              <ApprovalTimeline steps={reviewing.approvalSteps} requestStatus={reviewing.status} />
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
