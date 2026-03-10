import { useState } from 'react'
import {
  UsersIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
  CheckBadgeIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, EyeIcon,
  TableCellsIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'
import StatusBadge from '../shared/StatusBadge'
import VendorDetailModal from '../VendorDetailModal'
import Toast from '../shared/Toast'
import UserManagement from '../UserManagement'

const ADMIN_TABS = [
  { id: 'requests', label: 'Requests',        icon: TableCellsIcon  },
  { id: 'users',    label: 'User Management', icon: UserGroupIcon   },
]

const STATUS_FILTERS = ['All', 'Draft', 'PendingApproval', 'PendingFinalApproval', 'Rejected', 'Completed']

const STAT_CARDS = [
  { label: 'Total',          key: 'total',    icon: UsersIcon,       bg: 'bg-blue-50',    text: 'text-blue-700',    ic: 'text-blue-500'    },
  { label: 'Pending',        key: 'pending',  icon: ClockIcon,       bg: 'bg-amber-50',   text: 'text-amber-700',   ic: 'text-amber-500'   },
  { label: 'Final Approval', key: 'final',    icon: CheckCircleIcon, bg: 'bg-indigo-50',  text: 'text-indigo-700',  ic: 'text-indigo-500'  },
  { label: 'Rejected',       key: 'rejected', icon: XCircleIcon,     bg: 'bg-red-50',     text: 'text-red-700',     ic: 'text-red-500'     },
  { label: 'Completed',      key: 'completed',icon: CheckBadgeIcon,  bg: 'bg-emerald-50', text: 'text-emerald-700', ic: 'text-emerald-500' },
]

const STAT_KEY_TO_FILTER = {
  pending: 'PendingApproval', final: 'PendingFinalApproval',
  rejected: 'Rejected', completed: 'Completed',
}

function buildStats(requests) {
  return {
    total:    requests.length,
    pending:  requests.filter(r => r.status === 'PendingApproval').length,
    final:    requests.filter(r => r.status === 'PendingFinalApproval').length,
    rejected: requests.filter(r => r.status === 'Rejected').length,
    completed:requests.filter(r => r.status === 'Completed').length,
  }
}

export default function AdminConsole({ workflow }) {
  const { requests } = workflow
  const stats = buildStats(requests)

  const [activeTab, setActiveTab]           = useState('requests')
  const [filterStatus, setFilterStatus]     = useState('All')
  const [search, setSearch]                 = useState('')
  const [viewingRequest, setViewingRequest] = useState(null)
  const [toast, setToast]                   = useState(null)

  const visible = requests.filter(r => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q
      || r.vendorName.toLowerCase().includes(q)
      || r.createdByName.toLowerCase().includes(q)
      || (r.vendorCode ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const handleDownloadPdf = (req) => {
    setToast({
      type:  'success',
      title: 'PDF Export',
      body:  `PDF for "${req.vendorName}" will be available once the .NET API is connected.`,
    })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage vendor requests and user accounts</p>
      </div>

      {/* Top-level tab bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {ADMIN_TABS.map(({ id, label, icon: Icon }) => (
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
          </button>
        ))}
      </div>

      {/* ── User Management tab ─────────────────────────────────────────── */}
      {activeTab === 'users' && <UserManagement />}

      {/* ── Requests tab ────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (<>

      {/* Clickable stat cards — filter the table on click */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-7">
        {STAT_CARDS.map(({ label, key, icon: Icon, bg, text, ic }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key === 'total' ? 'All' : (STAT_KEY_TO_FILTER[key] ?? 'All'))}
            className={`card px-4 py-3.5 flex items-center gap-3 ${bg} text-left w-full
                        hover:ring-2 hover:ring-blue-400 transition-all`}
          >
            <Icon className={`h-7 w-7 ${ic} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-none">{stats[key]}</p>
              <p className={`text-xs font-medium ${text} mt-0.5`}>{label}</p>
            </div>
          </button>
        ))}
      </div>

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
                  ? 'bg-blue-700 text-white ring-blue-700'
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
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  No requests match the current filter.
                </td>
              </tr>
            )}
            {visible.map(req => (
              <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">#{req.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 whitespace-nowrap">{req.vendorName}</p>
                  {req.vendorCode && (
                    <p className="text-xs text-emerald-600 font-mono">{req.vendorCode}</p>
                  )}
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
                    <button
                      className="btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() => setViewingRequest(req)}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      className="btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() => handleDownloadPdf(req)}
                    >
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

      {/* Tabbed VendorDetailModal — Details · Revision History · Form Preview */}
      {viewingRequest && (
        <VendorDetailModal
          request={workflow.requests.find(r => r.id === viewingRequest.id) ?? viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}

      {toast && (
        <Toast
          message={{ title: toast.title, body: toast.body }}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      </>)}
    </div>
  )
}
