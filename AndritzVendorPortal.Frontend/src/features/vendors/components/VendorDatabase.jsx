import { useState } from 'react'
import { BuildingOfficeIcon, ArrowPathIcon, EyeIcon, ArchiveBoxIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import VendorDetailModal from './VendorDetailModal'
import Toast from '../../../shared/components/Toast'
import PageSizeSelect from '../../../shared/components/PageSizeSelect'
import { vendorsService } from '../services/vendorsService'

export default function VendorDatabase({ requests, isAdmin, onReclassified, workflow }) {
  const [showArchived, setShowArchived]       = useState(false)
  const vendors = requests.filter(r =>
    r.status === 'Completed' && !r.isOneTimeVendor && (showArchived ? r.isArchived : !r.isArchived)
  )
  const [viewingRequest, setViewingRequest]   = useState(null)
  const [reclassifying, setReclassifying]     = useState(null)
  const [reclassifyError, setReclassifyError] = useState(null)
  const [search, setSearch]                   = useState('')
  const [page, setPage]                       = useState(1)
  const [pageSize, setPageSize]               = useState(10)
  const [invalidating, setInvalidating]       = useState(null)
  const [invalidateLoading, setInvalidateLoading] = useState(false)
  const [invalidateError, setInvalidateError] = useState(null)
  const [restoring, setRestoring]             = useState(null)
  const [restoreLoading, setRestoreLoading]   = useState(false)
  const [restoreError, setRestoreError]       = useState(null)
  const [toast, setToast]                     = useState(null)

  const archivedCount = requests.filter(r => r.status === 'Completed' && !r.isOneTimeVendor && r.isArchived).length

  const handleRestore = async () => {
    if (!restoring) return
    setRestoreLoading(true)
    setRestoreError(null)
    try {
      await workflow.restoreRequest(restoring.id)
      setRestoring(null)
    } catch (err) {
      setRestoreError(err?.response?.data?.message ?? 'Failed to restore. Please try again.')
    } finally {
      setRestoreLoading(false)
    }
  }

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
      const data = await vendorsService.classify(req.id, true)
      onReclassified?.(data)
      setToast({ type: 'success', title: 'Vendor Reclassified', body: `${req.vendorName} has been moved to the One-Time Vendor list.` })
    } catch (err) {
      setReclassifyError(err?.response?.data?.message ?? err?.response?.data ?? 'Failed to reclassify vendor. Please try again.')
    } finally {
      setReclassifying(null)
    }
  }

  const handleInvalidate = async () => {
    if (!invalidating) return
    setInvalidateLoading(true)
    setInvalidateError(null)
    try {
      await vendorsService.remove(invalidating.id)
      onReclassified?.()   // triggers fetchAll in parent
      setInvalidating(null)
    } catch (err) {
      setInvalidateError(err?.response?.data?.message ?? err?.response?.data ?? 'Failed to archive vendor. Please try again.')
    } finally {
      setInvalidateLoading(false)
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
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => { setShowArchived(false); setPage(1) }}
              className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2 transition-colors select-none ${
                !showArchived
                  ? 'bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {requests.filter(r => r.status === 'Completed' && !r.isOneTimeVendor && !r.isArchived).length} Permanent Vendor{requests.filter(r => r.status === 'Completed' && !r.isOneTimeVendor && !r.isArchived).length !== 1 ? 's' : ''}
            </button>
            {archivedCount > 0 && (
              <button
                onClick={() => { setShowArchived(true); setPage(1) }}
                className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2 transition-colors select-none ${
                  showArchived
                    ? 'bg-amber-50 ring-1 ring-amber-200 text-amber-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <ArchiveBoxIcon className="h-4 w-4" />
                {archivedCount} Archived
              </button>
            )}
          </div>
        </div>
        <input
          className="form-input max-w-xs"
          placeholder="Search vendor, code, city, GST…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="text-sm" style={{ minWidth: '820px', width: '100%' }}>
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '26%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '15%' }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
              {['SAP Code', 'Vendor Name', 'City', 'GST Number', 'Approved On', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(() => {
              const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
              const paginated  = visible.slice((page - 1) * pageSize, page * pageSize)
              return (<>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  {vendors.length === 0
                    ? (showArchived ? 'No archived permanent vendors.' : 'No permanent vendors yet — appears once a form is fully approved.')
                    : 'No vendors match the search.'}
                </td>
              </tr>
            )}
            {paginated.map(req => (
              <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-emerald-700">{req.vendorCode}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{req.vendorName}</p>
                  <p className="text-xs text-gray-400">{req.contactPerson}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{req.city}, {req.locality}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{req.gstNumber}</td>
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {req.vendorCodeAssignedAt
                    ? new Date(req.vendorCodeAssignedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                    : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <button className="btn-secondary !py-1 !px-2 !text-xs" onClick={() => setViewingRequest(req)}>
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isAdmin && !showArchived && (
                      <>
                        <button
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          onClick={() => handleMoveToOneTime(req)}
                          disabled={reclassifying === req.id}
                          title="Move to One-Time vendor — removes from permanent master"
                        >
                          <ArrowPathIcon className="h-3.5 w-3.5" />
                          {reclassifying === req.id ? 'Moving…' : 'Move to One-Time'}
                        </button>
                        <button
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
                          onClick={() => { setInvalidating(req); setInvalidateError(null) }}
                          title="Archive this vendor — record is retained and can be restored by admin"
                        >
                          <ArchiveBoxIcon className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      </>
                    )}
                    {isAdmin && showArchived && (
                      <button
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors"
                        onClick={() => { setRestoring(req); setRestoreError(null) }}
                        title="Restore this vendor to the Permanent Vendor Master"
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
              </>)
            })()}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {visible.length === 0
                ? `0 of ${vendors.length} vendor${vendors.length !== 1 ? 's' : ''}`
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, visible.length)} of ${visible.length} vendor${visible.length !== 1 ? 's' : ''}`}
            </span>
            <PageSizeSelect value={pageSize} onChange={v => { setPageSize(v); setPage(1) }} />
          </div>
          {Math.ceil(visible.length / pageSize) > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 px-1">Page {page} of {Math.max(1, Math.ceil(visible.length / pageSize))}</span>
              <button
                className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={page >= Math.ceil(visible.length / pageSize)}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {reclassifyError && (
          <div className="px-4 py-2.5 border-t border-red-200 bg-red-50 text-xs text-red-700">
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

      {/* Invalidate confirmation modal */}
      {invalidating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Archive this vendor?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{invalidating.vendorName}</strong> (SAP code:{' '}
              <span className="font-mono">{invalidating.vendorCode}</span>) will be removed from the
              Permanent Vendor Master. The full record is retained and can be restored by an admin at any time.
            </p>
            {invalidateError && (
              <p className="text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{invalidateError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                className="btn-secondary"
                onClick={() => setInvalidating(null)}
                disabled={invalidateLoading}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60"
                onClick={handleInvalidate}
                disabled={invalidateLoading}
              >
                <ArchiveBoxIcon className="h-4 w-4" />
                {invalidateLoading ? 'Archiving…' : 'Yes, archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} title={toast.title} body={toast.body} onClose={() => setToast(null)} />}

      {/* Restore confirmation modal */}
      {restoring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Restore this vendor?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{restoring.vendorName}</strong> (SAP code:{' '}
              <span className="font-mono">{restoring.vendorCode}</span>) will be restored to the
              Permanent Vendor Master.
            </p>
            {restoreError && (
              <p className="text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{restoreError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                className="btn-secondary"
                onClick={() => setRestoring(null)}
                disabled={restoreLoading}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60"
                onClick={handleRestore}
                disabled={restoreLoading}
              >
                <ArrowPathIcon className="h-4 w-4" />
                {restoreLoading ? 'Restoring…' : 'Yes, restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
