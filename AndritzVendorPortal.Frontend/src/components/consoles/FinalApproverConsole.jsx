import { useState } from 'react'
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/24/solid'
import { XMarkIcon, EyeIcon, CheckIcon, ClockIcon, ArchiveBoxIcon,
         UsersIcon, ArrowPathIcon, NoSymbolIcon, TrophyIcon, BuildingOfficeIcon,
         ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const PAGE_SIZE = 10
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import VendorDatabase from '../VendorDatabase'
import Modal from '../shared/Modal'
import StatusBadge from '../shared/StatusBadge'
import ApprovalTimeline from '../shared/ApprovalTimeline'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import { useViewedRequests } from '../../hooks/useViewedRequests'
import { buildStats, buildMonthlyData } from '../../utils/statsUtils'

const BAR_COLORS = ['#096fb3','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#84cc16']

function buildMaterialData(requests) {
  const counts = {}
  requests.forEach(r => {
    const key = r.materialGroup?.trim() || 'Unspecified'
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value], i) => ({ name, value, fill: BAR_COLORS[i % BAR_COLORS.length] }))
}

const METRICS = [
  { label: 'Total Assigned', key: 'total',        icon: UsersIcon,       bg: 'bg-blue-50',    ic: 'text-blue-500',    text: 'text-blue-700',    navPage: 'pending'  },
  { label: 'Pending',        key: 'finalPending',  icon: ClockIcon,       bg: 'bg-amber-50',   ic: 'text-amber-500',   text: 'text-amber-700',   navPage: 'pending'  },
  { label: 'Awaiting Me',    key: 'finalPending',  icon: CheckBadgeIcon,  bg: 'bg-indigo-50',  ic: 'text-indigo-500',  text: 'text-indigo-700',  navPage: 'pending'  },
  { label: 'Completed',      key: 'completed',     icon: CheckIcon,       bg: 'bg-emerald-50', ic: 'text-emerald-500', text: 'text-emerald-700', navPage: 'history'  },
  { label: 'Rejected',       key: 'rejected',      icon: NoSymbolIcon,    bg: 'bg-red-50',     ic: 'text-red-500',     text: 'text-red-700',     navPage: 'history'  },
  { label: 'Approval Rate',  key: 'approvalRate',  icon: TrophyIcon,      bg: 'bg-cyan-50',    ic: 'text-cyan-500',    text: 'text-cyan-700'                         },
  { label: 'Re-edit Rate',   key: 'reEditRate',    icon: ArrowPathIcon,   bg: 'bg-orange-50',  ic: 'text-orange-500',  text: 'text-orange-700'                       },
  { label: 'Rejection Rate', key: 'rejectionRate', icon: NoSymbolIcon,    bg: 'bg-rose-50',    ic: 'text-rose-500',    text: 'text-rose-700'                         },
]

export default function FinalApproverConsole({ workflow, currentUser, activePage, onNavigate }) {
  const queue   = workflow.getPendingFor(currentUser.id)
  const history = workflow.getHistoryFor(currentUser.id)
  const myRequests = [...queue, ...history]
  const stats   = {
    ...buildStats(myRequests),
    total:        myRequests.length,
    finalPending: queue.length,
  }

  const [reviewing, setReviewing]           = useState(null)
  const [vendorCode, setVendorCode]         = useState('')
  const [vendorCodeErr, setVendorCodeErr]   = useState('')
  const [rejectMode, setRejectMode]         = useState(false)
  const [rejectComment, setRejectComment]   = useState('')
  const [rejectError, setRejectError]       = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [toast, setToast]                   = useState(null)
  const [queuePage, setQueuePage]           = useState(1)
  const [historyPage, setHistoryPage]       = useState(1)
  const [queueSearch, setQueueSearch]       = useState('')
  const [historySearch, setHistorySearch]   = useState('')

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
    try {
      await workflow.reject(reviewing.id, rejectComment)
      setReviewing(null)
      setToast({ type: 'warning', title: 'Request Rejected', body: `You rejected the vendor request for ${name}. The buyer will be notified to revise and resubmit.` })
    } catch (err) {
      setRejectError(err?.response?.data?.message ?? err?.response?.data ?? 'Failed to reject request. Please try again.')
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
            {METRICS.map(({ label, key, icon: Icon, bg, ic, text, navPage }) => (
              <button
                key={key}
                onClick={() => { if (navPage) onNavigate(navPage) }}
                className={`card px-3 py-3.5 flex flex-col items-center gap-1.5 ${bg} text-center w-full
                            ${navPage ? 'hover:ring-2 hover:ring-slate-600' : 'cursor-default'} transition-all`}
              >
                <Icon className={`h-6 w-6 ${ic} flex-shrink-0`} />
                <p className="text-xl font-bold text-gray-900 leading-none">{stats[key]}</p>
                <p className={`text-xs font-medium ${text} leading-tight`}>{label}</p>
              </button>
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
                <ResponsiveContainer width="100%" height={280}>
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
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={buildMaterialData(workflow.requests)} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 'dataMax+1']} />
                    <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false}
                      tick={({ x, y, payload }) => (
                        <text x={x} y={y} dy={4} textAnchor="end" fill="#6b7280" fontSize={10}>
                          {payload.value.length > 18 ? payload.value.slice(0, 17) + '…' : payload.value}
                        </text>
                      )}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                      {buildMaterialData(workflow.requests).map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Queue ───────────────────────────────────────────────────── */}
      {activePage === 'pending' && (() => {
        const filtered   = queue.filter(r => matchesSearch(r, queueSearch))
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const paginated  = filtered.slice((queuePage - 1) * PAGE_SIZE, queuePage * PAGE_SIZE)
        return (
        <div className="space-y-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by vendor, contact, city…"
              value={queueSearch}
              onChange={e => { setQueueSearch(e.target.value); setQueuePage(1) }}
              className="form-input pl-9 text-sm"
            />
          </div>
          {filtered.length === 0 && (
            <div className="card p-12 text-center">
              <CheckBadgeIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{queueSearch ? 'No results match your search.' : 'No requests awaiting your approval.'}</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Intermediates</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Submitted On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map(req => {
                    const intermediateSteps = req.approvalSteps.filter(s => !s.isFinalApproval)
                    const allIntermediate   = intermediateSteps.every(s => s.decision === 'Approved')
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{req.vendorName}</p>
                            {req.revisionNo > 0 && (
                              <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                            )}
                            {isNew(req) && (
                              <span className="text-xs bg-indigo-500 text-white font-bold px-2 py-0.5 rounded-full">NEW</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{req.contactInformation}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">{req.city}, {req.locality}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset ${
                            allIntermediate
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-amber-50 text-amber-700 ring-amber-200'
                          }`}>
                            <CheckBadgeIcon className="h-3 w-3" />
                            {allIntermediate ? 'All approved' : 'In progress'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => { markViewed(req); setViewingRequest(req) }}>
                              <EyeIcon className="h-3.5 w-3.5" />
                              View
                            </button>
                            {isAuthorizedFinalApprover && (
                              <button
                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white bg-[#096fb3] hover:bg-[#075d99] transition-colors"
                                onClick={() => openReview(req)}
                              >
                                <StarIcon className="h-3.5 w-3.5" />
                                Final Review
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">Showing {filtered.length === 0 ? 0 : (queuePage - 1) * PAGE_SIZE + 1}–{Math.min(queuePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={queuePage === 1} onClick={() => setQueuePage(p => p - 1)}><ChevronLeftIcon className="h-4 w-4" /></button>
                    <span className="text-xs text-gray-500 px-1">Page {queuePage} of {totalPages}</span>
                    <button className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" disabled={queuePage === totalPages} onClick={() => setQueuePage(p => p + 1)}><ChevronRightIcon className="h-4 w-4" /></button>
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
        const filtered   = history.filter(r => matchesSearch(r, historySearch))
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
        const paginated  = filtered.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)
        return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-2 select-none">
              <CheckIcon className="h-4 w-4" />
              {history.length} Completed
            </span>
            <div className="relative flex-1 sm:max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by vendor, contact, city…"
                value={historySearch}
                onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1) }}
                className="form-input pl-9 text-sm"
              />
            </div>
          </div>
          {filtered.length === 0 && (
            <div className="card p-12 text-center">
              <ArchiveBoxIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{historySearch ? 'No results match your search.' : 'No vendor registrations acted upon yet.'}</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SAP Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Decision</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Decided On</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {paginated.map(req => {
                    const step       = myStepFor(req)
                    const isApproved = step?.decision === 'Approved'
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-gray-900">{req.vendorName}</p>
                            <StatusBadge status={req.status} />
                            {req.revisionNo > 0 && (
                              <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                            )}
                          </div>
                          {step?.comment && <p className="text-xs text-gray-400 mt-0.5 italic">"{step.comment}"</p>}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500">{req.city}, {req.locality}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-emerald-600">{req.vendorCode || '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap ${
                            isApproved ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
                          }`}>
                            {isApproved ? <CheckIcon className="h-3 w-3" /> : <XMarkIcon className="h-3 w-3" />}
                            Final {isApproved ? 'approved' : 'rejected'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                          {step?.decidedAt ? new Date(step.decidedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                            <EyeIcon className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">Showing {filtered.length === 0 ? 0 : (historyPage - 1) * PAGE_SIZE + 1}–{Math.min(historyPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
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
              <ApprovalTimeline steps={reviewing.approvalSteps} requestStatus={reviewing.status} />
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
