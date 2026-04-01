import { useState } from 'react'
import {
  UsersIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
  CheckBadgeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, EyeIcon,
  TableCellsIcon, UserGroupIcon, ArrowPathIcon, TrophyIcon, NoSymbolIcon,
  PencilSquareIcon, XMarkIcon, BuildingOfficeIcon, ArchiveBoxIcon, ArchiveBoxArrowDownIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import VendorDatabase from '../VendorDatabase'
import StatusBadge from '../shared/StatusBadge'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import UserManagement from '../UserManagement'
import api from '../../services/api'
import { buildStats, buildMonthlyData } from '../../utils/statsUtils'

const BAR_COLORS = ['#096fb3','#f59e0b','#10b981','#ef4444','#8b5cf6','#f97316','#06b6d4','#84cc16']

const STATUS_FILTERS = ['All', 'PendingApproval', 'PendingFinalApproval', 'Rejected', 'Completed', 'Archived']

const STAT_CARDS = [
  { label: 'Total',          key: 'total',        icon: UsersIcon,       bg: 'bg-blue-50',    text: 'text-blue-700',    ic: 'text-blue-500'    },
  { label: 'Pending',        key: 'pending',      icon: ClockIcon,       bg: 'bg-amber-50',   text: 'text-amber-700',   ic: 'text-amber-500'   },
  { label: 'Final Approval', key: 'final',        icon: CheckCircleIcon, bg: 'bg-indigo-50',  text: 'text-indigo-700',  ic: 'text-indigo-500'  },
  { label: 'Rejected',       key: 'rejected',     icon: XCircleIcon,     bg: 'bg-red-50',     text: 'text-red-700',     ic: 'text-red-500'     },
  { label: 'Completed',      key: 'completed',    icon: CheckBadgeIcon,  bg: 'bg-emerald-50', text: 'text-emerald-700', ic: 'text-emerald-500' },
  { label: 'Approval Rate',  key: 'approvalRate', icon: TrophyIcon,      bg: 'bg-cyan-50',    text: 'text-cyan-700',    ic: 'text-cyan-500',   noFilter: true },
  { label: 'Re-edit Rate',   key: 'reEditRate',   icon: ArrowPathIcon,   bg: 'bg-orange-50',  text: 'text-orange-700',  ic: 'text-orange-500', noFilter: true },
  { label: 'Rejection Rate', key: 'rejectionRate',icon: NoSymbolIcon,    bg: 'bg-rose-50',    text: 'text-rose-700',    ic: 'text-rose-500',   noFilter: true },
]

const STAT_KEY_TO_FILTER = {
  pending: 'PendingApproval', final: 'PendingFinalApproval',
  rejected: 'Rejected', completed: 'Completed',
}

function buildMaterialData(requests) {
  const counts = {}
  requests.forEach(r => {
    const key = r.materialGroup?.trim() || 'Unspecified'
    counts[key] = (counts[key] ?? 0) + 1
  })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: BAR_COLORS[i % BAR_COLORS.length] }))
}

// ── Admin Edit Form Modal ─────────────────────────────────────────────────────
function AdminEditModal({ request, onClose, onSaved }) {
  const [form, setForm] = useState({
    vendorName:     request.vendorName     ?? '',
    contactPerson:  request.contactPerson  ?? '',
    telephone:      request.telephone      ?? '',
    gstNumber:      request.gstNumber      ?? '',
    panCard:        request.panCard        ?? '',
    addressDetails: request.addressDetails ?? '',
    city:           request.city           ?? '',
    locality:       request.locality       ?? '',
    materialGroup:  request.materialGroup  ?? '',
    postalCode:     request.postalCode     ?? '',
    state:          request.state          ?? '',
    country:        request.country        ?? 'India',
    currency:       request.currency       ?? 'INR',
    paymentTerms:   request.paymentTerms   ?? '',
    incoterms:      request.incoterms      ?? '',
    reason:         request.reason         ?? '',
    yearlyPvo:      request.yearlyPvo      ?? '',
    isOneTimeVendor:request.isOneTimeVendor ?? false,
    proposedBy:     request.proposedBy     ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const handleSave = async () => {
    if (!form.vendorName.trim() || !form.gstNumber.trim() || !form.panCard.trim() ||
        !form.addressDetails.trim() || !form.city.trim() || !form.locality.trim() ||
        !form.contactPerson.trim()) {
      setError('Vendor Name, Contact Person, GST, PAN, Address, City and Locality are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data } = await api.put(`/vendor-requests/${request.id}`, {
        vendorName:      form.vendorName,
        contactPerson:   form.contactPerson,
        telephone:       form.telephone      || null,
        gstNumber:       form.gstNumber,
        panCard:         form.panCard,
        addressDetails:  form.addressDetails,
        city:            form.city,
        locality:        form.locality,
        materialGroup:   form.materialGroup  || null,
        postalCode:      form.postalCode     || null,
        state:           form.state          || null,
        country:         form.country        || null,
        currency:        form.currency       || null,
        paymentTerms:    form.paymentTerms   || null,
        incoterms:       form.incoterms      || null,
        reason:          form.reason         || null,
        yearlyPvo:       form.yearlyPvo      || null,
        isOneTimeVendor: form.isOneTimeVendor,
        proposedBy:      form.proposedBy     || null,
      })
      onSaved(data)
      onClose()
    } catch (err) {
      const detail = err.response?.data
      if (Array.isArray(detail))             setError(detail.join(' '))
      else if (typeof detail === 'string')   setError(detail)
      else if (detail?.errors) {
        const msgs = Object.values(detail.errors).flat()
        setError(msgs.join(' '))
      }
      else if (detail?.title)                setError(detail.title)
      else                                   setError('Save failed. Please check all required fields.')
    } finally {
      setSaving(false)
    }
  }

  const fi = (label, field, opts = {}) => (
    <div key={field}>
      <label className="form-label">{label}</label>
      <input className="form-input" value={form[field]} onChange={e => set(field, e.target.value)} {...opts} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-gray-900">Admin Edit — {request.vendorName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">#{request.id} · All fields editable (Completed requests only)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          {error && <div className="rounded-lg bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Vendor Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fi('Supplier Name *', 'vendorName')}
              {fi('Contact Person *', 'contactPerson')}
              {fi('Telephone', 'telephone')}
              {fi('Material Group', 'materialGroup')}
              {fi('Reason for Registration', 'reason')}
              <div>
                <label className="form-label">Proposed By</label>
                <textarea className="form-input resize-none" rows={2} value={form.proposedBy} onChange={e => set('proposedBy', e.target.value)} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="adm-otv" checked={form.isOneTimeVendor} onChange={e => set('isOneTimeVendor', e.target.checked)} className="rounded border-gray-300" />
                <label htmlFor="adm-otv" className="text-sm text-gray-700">One-Time Vendor</label>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Compliance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fi('GST Number *', 'gstNumber')}
              {fi('PAN Card *', 'panCard')}
              {fi('Yearly PVO', 'yearlyPvo')}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">{fi('Street / Building / Plot *', 'addressDetails')}</div>
              {fi('City *', 'city')}
              {fi('Locality *', 'locality')}
              {fi('State', 'state')}
              {fi('Postal Code', 'postalCode')}
              {fi('Country', 'country')}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Commercial</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fi('Currency', 'currency')}
              {fi('Payment Terms', 'paymentTerms')}
              {fi('Incoterms', 'incoterms')}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main AdminConsole ─────────────────────────────────────────────────────────

export default function AdminConsole({ workflow, currentUser, activePage, onNavigate }) {
  const { requests } = workflow
  // Exclude archived records from all stats, charts, and recent activity —
  // they are only visible when the 'Archived' filter is explicitly selected.
  const liveRequests = requests.filter(r => !r.isArchived)
  const stats = buildStats(liveRequests)

  const [filterStatus, setFilterStatus]     = useState('All')
  const [search, setSearch]                 = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [previewRequest, setPreviewRequest] = useState(null)
  const [editingRequest, setEditingRequest] = useState(null)
  const [archivingRequest, setArchivingRequest] = useState(null)
  const [archiveLoading, setArchiveLoading]     = useState(false)
  const [toast, setToast]                       = useState(null)
  const [reqPage, setReqPage]                   = useState(1)

  const handleArchive = async () => {
    if (!archivingRequest) return
    setArchiveLoading(true)
    try {
      await workflow.deleteRequest(archivingRequest.id)
      setArchivingRequest(null)
      setToast({ type: 'success', title: 'Request archived', body: `"${archivingRequest.vendorName}" has been archived and can be restored from the Archived filter.` })
    } catch {
      setToast({ type: 'error', title: 'Archive failed', body: 'Could not archive the request. Please try again.' })
    } finally {
      setArchiveLoading(false)
    }
  }

  const handleRestore = async (req) => {
    try {
      await workflow.restoreRequest(req.id)
      setToast({ type: 'success', title: 'Request restored', body: `"${req.vendorName}" has been restored.` })
    } catch {
      setToast({ type: 'error', title: 'Restore failed', body: 'Could not restore the request. Please try again.' })
    }
  }

  const handleAdminSaved = (updated) => {
    workflow.fetchAll?.()
    setToast({ type: 'success', title: 'Request updated', body: `${updated.vendorName} has been updated.` })
  }

  const visible = requests.filter(r => {
    const matchDate = (() => {
      if (!dateFrom && !dateTo) return true
      const d = new Date(r.createdAt)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false
      return true
    })()
    if (filterStatus === 'Archived') return r.isArchived && matchDate
    if (!r.isArchived) {
      const matchStatus = filterStatus === 'All' || r.status === filterStatus
      const q = search.toLowerCase()
      const matchSearch = !q
        || r.vendorName.toLowerCase().includes(q)
        || r.createdByName.toLowerCase().includes(q)
        || (r.vendorCode ?? '').toLowerCase().includes(q)
      return matchStatus && matchSearch && matchDate
    }
    return false
  })

  const recentRequests = [...liveRequests]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)

  // ── Render ─────────────────────────────────────────────────────────────────

  if (workflow.loading && workflow.requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-[#096fb3] border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── Dashboard ─────────────────────────────────────────────────────── */}
      {activePage === 'dashboard' && (() => {
        const materialData = buildMaterialData(liveRequests)
        const monthlyData  = buildMonthlyData(liveRequests)
        return (
        <div className="space-y-5">
          {/* Clickable stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {STAT_CARDS.map(({ label, key, icon: Icon, bg, text, ic, noFilter }) => (
              <button
                key={key}
                onClick={() => {
                  if (noFilter) return
                  setFilterStatus(key === 'total' ? 'All' : (STAT_KEY_TO_FILTER[key] ?? 'All'))
                  onNavigate('requests')
                }}
                className={`card px-3 py-3.5 flex flex-col items-center gap-1.5 ${bg} text-center w-full
                            ${noFilter ? 'cursor-default' : 'hover:ring-2 hover:ring-slate-600'} transition-all`}
              >
                <Icon className={`h-6 w-6 ${ic} flex-shrink-0`} />
                <p className="text-xl font-bold text-gray-900 leading-none">{stats[key]}</p>
                <p className={`text-xs font-medium ${text} leading-tight`}>{label}</p>
              </button>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">

            {/* Monthly requests */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 340 }}>
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Monthly Requests</h3>
              </div>
              <div className="px-2 py-4 flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barSize={24} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f0f7ff' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="count" fill="#096fb3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Requests by material group */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden flex flex-col" style={{ minHeight: 340 }}>
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Top Requests by Material Group</h3>
              </div>
              <div className="px-2 py-4 flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={materialData} layout="vertical" margin={{ top: 0, right: 24, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 'dataMax+1']} />
                    <YAxis type="category" dataKey="name" width={175} axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [v, 'Requests']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                      {materialData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent requests */}
          <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Recent Requests</h3>
              <button
                className="text-xs text-slate-600 hover:text-slate-800 font-medium transition-colors"
                onClick={() => onNavigate('requests')}
              >
                View all →
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Buyer</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Status</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-28 whitespace-nowrap">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recentRequests.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">No requests yet.</td></tr>
                )}
                {recentRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 cursor-pointer transition-colors divide-x divide-gray-200" onClick={() => setViewingRequest(req)}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900 leading-snug">{req.vendorName}</p>
                      {req.vendorCode && <p className="text-xs text-emerald-600 font-mono mt-0.5">{req.vendorCode}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-center">{req.createdByName}</td>
                    <td className="px-5 py-3.5 text-center"><StatusBadge status={req.status} /></td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap text-center">{new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
        )
      })()}

      {/* ── All Requests ──────────────────────────────────────────────────── */}
      {activePage === 'requests' && (
        <>
          {/* Filters */}
          <div className="flex flex-row items-center gap-3 mb-4 overflow-x-auto">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                className="form-input pl-9"
                placeholder="Search vendor, buyer, code..."
                value={search}
                onChange={e => { setSearch(e.target.value); setReqPage(1) }}
              />
            </div>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setReqPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="From date" />
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setReqPage(1) }}
              className="form-input text-sm w-36 shrink-0" title="To date" />
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setReqPage(1) }}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    filterStatus === s && s === 'Archived'
                      ? 'bg-amber-500 text-white ring-amber-500'
                      : filterStatus === s
                      ? 'bg-slate-700 text-white ring-slate-700'
                      : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s === 'PendingApproval' ? 'Pending' : s === 'PendingFinalApproval' ? 'Final' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Archived banner */}
          {filterStatus === 'Archived' && (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3">
              <ArchiveBoxIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Archived Requests</p>
                <p className="text-xs text-amber-600 mt-0.5">Records are fully retained. Use Restore to return a request to the active view.</p>
              </div>
            </div>
          )}

          {/* Table */}
          {(() => {
            const PAGE_SIZE  = 10
            const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
            const paginated  = visible.slice((reqPage - 1) * PAGE_SIZE, reqPage * PAGE_SIZE)
            return (
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
                  {['ID', 'Vendor Name', 'Buyer', 'City', 'Revision', 'Status', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginated.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No requests match the current filter.</td></tr>
                )}
                {paginated.map((req, idx) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-400">#{(reqPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 whitespace-nowrap leading-snug">{req.vendorName}</p>
                      {req.vendorCode && <p className="text-xs text-emerald-600 font-mono mt-0.5">{req.vendorCode}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{req.createdByName}</td>
                    <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{req.city}, {req.locality}</td>
                    <td className="px-4 py-3.5 text-center">
                      {req.revisionNo > 0
                        ? <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3.5">
                      {req.isArchived ? (
                        <div className="flex items-center gap-1">
                          <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                            <EyeIcon className="h-3.5 w-3.5" />
                            View
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
                            onClick={() => handleRestore(req)}
                            title="Restore this archived request"
                          >
                            <ArchiveBoxArrowDownIcon className="h-3.5 w-3.5" />
                            Restore
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                              <EyeIcon className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              className={`btn-secondary !py-1 !px-2 !text-xs transition-all ${req.status !== 'Completed' ? 'opacity-30 cursor-not-allowed' : ''}`}
                              disabled={req.status !== 'Completed'}
                              onClick={() => setEditingRequest(req)}
                              title={req.status !== 'Completed' ? 'Only Completed forms can be edited' : 'Edit form'}
                            >
                              <PencilSquareIcon className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setPreviewRequest(workflow.requests.find(r => r.id === req.id) ?? req)}>
                              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                              PDF
                            </button>
                          </div>
                          {req.status === 'Completed' && (
                            <button
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors w-fit"
                              onClick={() => setArchivingRequest(req)}
                              title="Archive this request — record is retained and can be restored"
                            >
                              <ArchiveBoxIcon className="h-3.5 w-3.5" />
                              Archive
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs text-gray-400">
                {visible.length === 0
                  ? 'No requests'
                  : `Showing ${(reqPage - 1) * PAGE_SIZE + 1}–${Math.min(reqPage * PAGE_SIZE, visible.length)} of ${visible.length} request${visible.length !== 1 ? 's' : ''}`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    disabled={reqPage === 1}
                    onClick={() => setReqPage(p => p - 1)}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-gray-500 px-1">Page {reqPage} of {totalPages}</span>
                  <button
                    className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    disabled={reqPage === totalPages}
                    onClick={() => setReqPage(p => p + 1)}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
          )})()}
        </>
      )}

      {/* ── Vendor Database ────────────────────────────────────────────────── */}
      {activePage === 'vendors' && (
        <VendorDatabase requests={requests} isAdmin={true} onReclassified={() => workflow.fetchAll()} workflow={workflow} />
      )}

      {/* ── User Management ───────────────────────────────────────────────── */}
      {activePage === 'users' && <UserManagement />}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}
      {previewRequest && (
        <VendorDetailModal request={previewRequest} initialTab="preview" onClose={() => setPreviewRequest(null)} />
      )}
      {editingRequest && (
        <AdminEditModal
          request={workflow.requests.find(r => r.id === editingRequest.id) ?? editingRequest}
          onClose={() => setEditingRequest(null)}
          onSaved={handleAdminSaved}
        />
      )}
      {/* ── Archive confirmation ──────────────────────────────────────────── */}
      {archivingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Archive this request?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{archivingRequest.vendorName}</strong> will be moved to the Archived view.
              The record and its full history are retained and can be restored at any time.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                className="btn-secondary"
                onClick={() => setArchivingRequest(null)}
                disabled={archiveLoading}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60"
                onClick={handleArchive}
                disabled={archiveLoading}
              >
                <ArchiveBoxIcon className="h-4 w-4" />
                {archiveLoading ? 'Archiving…' : 'Yes, archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
