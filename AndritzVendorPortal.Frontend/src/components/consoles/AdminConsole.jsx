import { useState } from 'react'
import {
  UsersIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
  CheckBadgeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, EyeIcon,
  TableCellsIcon, UserGroupIcon, ArrowPathIcon, TrophyIcon, NoSymbolIcon,
  PencilSquareIcon, XMarkIcon, BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import VendorDatabase from '../VendorDatabase'
import StatusBadge from '../shared/StatusBadge'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import UserManagement from '../UserManagement'
import api from '../../services/api'
import { buildStats } from '../../utils/statsUtils'

const STATUS_FILTERS = ['All', 'PendingApproval', 'PendingFinalApproval', 'Rejected', 'Completed']

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
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))
}

function buildMonthlyData(requests) {
  const counts = {}
  requests.forEach(r => {
    const d = new Date(r.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = (counts[key] ?? 0) + 1
  })
  // Fill last 6 months even if zero
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    months.push({ key, label, count: counts[key] ?? 0 })
  }
  return months
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
            <p className="text-xs text-gray-400 mt-0.5">#{request.id} · All fields editable regardless of status</p>
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
  const stats = buildStats(requests)

  const [filterStatus, setFilterStatus]     = useState('All')
  const [search, setSearch]                 = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [previewRequest, setPreviewRequest] = useState(null)
  const [editingRequest, setEditingRequest] = useState(null)
  const [toast, setToast]                   = useState(null)

  const handleAdminSaved = (updated) => {
    workflow.fetchAll?.()
    setToast({ type: 'success', title: 'Request updated', body: `${updated.vendorName} has been updated.` })
  }

  const visible = requests.filter(r => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q
      || r.vendorName.toLowerCase().includes(q)
      || r.createdByName.toLowerCase().includes(q)
      || (r.vendorCode ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const recentRequests = [...requests]
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
        const materialData = buildMaterialData(requests)
        const monthlyData  = buildMonthlyData(requests)
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Monthly requests */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Monthly Requests</h3>
                <p className="text-xs text-gray-400 mt-0.5">Requests submitted over the last 6 months</p>
              </div>
              <div className="px-4 py-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      cursor={{ fill: '#f8fafc' }}
                      formatter={(v) => [v, 'Requests']}
                    />
                    <Bar dataKey="count" fill="#096fb3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Requests by material group */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Requests by Material Group</h3>
                <p className="text-xs text-gray-400 mt-0.5">Top 8 material categories</p>
              </div>
              <div className="px-4 py-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={materialData} layout="vertical" barSize={16} margin={{ top: 0, right: 32, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax+1']} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false}
                      tick={({ x, y, payload }) => (
                        <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="#64748b">
                          {payload.value.length > 16 ? payload.value.slice(0, 15) + '…' : payload.value}
                        </text>
                      )}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      cursor={{ fill: '#f8fafc' }}
                      formatter={(v) => [v, 'Requests']}
                    />
                    <Bar dataKey="count" fill="#096fb3" radius={[0, 4, 4, 0]} />
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
            <table className="w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Buyer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28 whitespace-nowrap">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {recentRequests.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">No requests yet.</td></tr>
                )}
                {recentRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setViewingRequest(req)}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{req.vendorName}</p>
                      {req.vendorCode && <p className="text-xs text-emerald-600 font-mono">{req.vendorCode}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{req.createdByName}</td>
                    <td className="px-5 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                className="form-input pl-9"
                placeholder="Search vendor, buyer, code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    filterStatus === s
                      ? 'bg-slate-700 text-white ring-slate-700'
                      : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {s === 'PendingApproval' ? 'Pending' : s === 'PendingFinalApproval' ? 'Final' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Vendor Name', 'Buyer', 'City', 'Revision', 'Status', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {visible.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">No requests match the current filter.</td></tr>
                )}
                {visible.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">#{req.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 whitespace-nowrap">{req.vendorName}</p>
                      {req.vendorCode && <p className="text-xs text-emerald-600 font-mono">{req.vendorCode}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{req.createdByName}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{req.city}, {req.locality}</td>
                    <td className="px-4 py-3 text-center">
                      {req.revisionNo > 0
                        ? <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full">REV {req.revisionNo}</span>
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(req.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                          <EyeIcon className="h-3.5 w-3.5" />
                          View
                        </button>
                        <button
                          className={`btn-secondary !py-1 !px-2 !text-xs transition-all ${req.status !== 'Completed' ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={req.status !== 'Completed'}
                          onClick={() => setEditingRequest(req)}
                          title={req.status !== 'Completed' ? 'Only SAP-approved (Completed) forms can be edited' : 'Edit form'}
                        >
                          <PencilSquareIcon className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setPreviewRequest(workflow.requests.find(r => r.id === req.id) ?? req)}>
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
              Showing {visible.length} of {requests.length} request{requests.length !== 1 ? 's' : ''}
            </div>
          </div>
        </>
      )}

      {/* ── Vendor Database ────────────────────────────────────────────────── */}
      {activePage === 'vendors' && (
        <VendorDatabase requests={requests} isAdmin={true} onReclassified={() => workflow.fetchAll()} />
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
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
