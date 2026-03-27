import { useState } from 'react'
import { BuildingOfficeIcon, ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline'
import VendorDetailModal from './VendorDetailModal'
import api from '../services/api'

export default function VendorDatabase({ requests, isAdmin, onReclassified }) {
  const vendors = requests.filter(r => r.status === 'Completed' && !r.isOneTimeVendor)
  const [viewingRequest, setViewingRequest] = useState(null)
  const [reclassifying, setReclassifying]   = useState(null)
  const [reclassifyError, setReclassifyError] = useState(null)
  const [search, setSearch]                 = useState('')

  const visible = vendors.filter(r => {
    const q = search.toLowerCase()
    return !q
      || r.vendorName.toLowerCase().includes(q)
      || (r.vendorCode ?? '').toLowerCase().includes(q)
      || r.city.toLowerCase().includes(q)
      || r.gstNumber.toLowerCase().includes(q)
  })

  const handleMoveToOneTime = async (req) => {
    setReclassifying(req.id)
    setReclassifyError(null)
    try {
      const { data } = await api.patch(`/vendor-requests/${req.id}/classify`, { isOneTimeVendor: true })
      onReclassified?.(data)
    } catch (err) {
      setReclassifyError(err?.response?.data?.message ?? err?.response?.data ?? 'Failed to reclassify vendor. Please try again.')
    } finally {
      setReclassifying(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BuildingOfficeIcon className="h-5 w-5 text-[#0062AC]" />
            Permanent Vendor Master
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendors.length} SAP-registered vendor{vendors.length !== 1 ? 's' : ''} · fully approved, not one-time
          </p>
        </div>
        <input
          className="form-input max-w-xs"
          placeholder="Search vendor, code, city, GST…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['SAP Code', 'Vendor Name', 'City', 'GST Number', 'Approved On', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  {vendors.length === 0 ? 'No permanent vendors yet — appears once a form is fully approved.' : 'No vendors match the search.'}
                </td>
              </tr>
            )}
            {visible.map(req => (
              <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-emerald-700">{req.vendorCode}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{req.vendorName}</p>
                    <span className="text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset px-2 py-0.5 rounded-full font-medium">Permanent</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{req.contactPerson}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{req.city}, {req.locality}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{req.gstNumber}</td>
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {req.vendorCodeAssignedAt
                    ? new Date(req.vendorCodeAssignedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isAdmin && (
                      <button
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        onClick={() => handleMoveToOneTime(req)}
                        disabled={reclassifying === req.id}
                        title="Move to One-Time vendor — removes from permanent master"
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        {reclassifying === req.id ? 'Moving…' : 'Move to One-Time'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
          Showing {visible.length} of {vendors.length} permanent vendor{vendors.length !== 1 ? 's' : ''}
        </div>
        {reclassifyError && (
          <div className="px-4 py-2.5 border-t border-red-100 bg-red-50 text-xs text-red-700">
            {reclassifyError}
          </div>
        )}
      </div>

      {viewingRequest && (
        <VendorDetailModal
          request={viewingRequest}
          onClose={() => setViewingRequest(null)}
        />
      )}
    </div>
  )
}
