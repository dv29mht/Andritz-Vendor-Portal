import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArchiveBoxIcon, ArrowPathIcon, EyeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from './services/api'
import { useAuth } from './contexts/AuthContext'
import { ROLES } from './constants/roles'
import { useVendorWorkflow } from './hooks/useVendorWorkflow'
import Login from './pages/Login'
import AppShell from './components/AppShell'
import BuyerConsole from './components/consoles/BuyerConsole'
import ApproverConsole from './components/consoles/ApproverConsole'
import FinalApproverConsole from './components/consoles/FinalApproverConsole'
import AdminConsole from './components/consoles/AdminConsole'
import SettingsPage from './pages/SettingsPage'
import StatusBadge from './components/shared/StatusBadge'
import VendorDetailModal from './components/VendorDetailModal'
import Toast from './components/shared/Toast'
import PageSizeSelect from './components/shared/PageSizeSelect'

function OneTimeVendorPage({ workflow, currentUser }) {
  const isAdmin = currentUser?.role === 'Admin'
  const [viewing,          setViewing]          = useState(null)
  const [page,             setPage]             = useState(1)
  const [pageSize,         setPageSize]         = useState(10)
  const [archiving,        setArchiving]        = useState(null)
  const [archiveLoading,   setArchiveLoading]   = useState(false)
  const [archiveError,     setArchiveError]     = useState(null)
  const [movingId,         setMovingId]         = useState(null)
  const [moveError,        setMoveError]        = useState(null)
  const [toast,            setToast]            = useState(null)
  const [showArchived,     setShowArchived]     = useState(false)
  const [restoring,        setRestoring]        = useState(null)
  const [restoreLoading,   setRestoreLoading]   = useState(false)
  const [restoreError,     setRestoreError]     = useState(null)

  const [search, setSearch] = useState('')

  const archivedCount = workflow.requests.filter(r => r.isOneTimeVendor && r.isArchived && r.status === 'Completed').length
  const oneTime    = workflow.requests.filter(r => r.isOneTimeVendor && (showArchived ? r.isArchived : !r.isArchived) && r.status === 'Completed')
  const filtered   = oneTime.filter(r => {
    const q = search.toLowerCase()
    return !q || r.vendorName?.toLowerCase().includes(q) || r.gstNumber?.toLowerCase().includes(q)
      || r.city?.toLowerCase().includes(q) || r.contactPerson?.toLowerCase().includes(q)
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

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

  const handleArchive = async () => {
    if (!archiving) return
    setArchiveLoading(true)
    setArchiveError(null)
    try {
      await workflow.deleteRequest(archiving.id)
      setArchiving(null)
    } catch (err) {
      setArchiveError(err?.response?.data?.message ?? 'Failed to archive. Please try again.')
    } finally {
      setArchiveLoading(false)
    }
  }

  const handleMoveToPermanent = async (req) => {
    setMovingId(req.id)
    setMoveError(null)
    try {
      await api.patch(`/vendor-requests/${req.id}/classify`, { isOneTimeVendor: false })
      await workflow.fetchAll()
      setToast({ type: 'success', title: 'Vendor Reclassified', body: `${req.vendorName} has been moved to the Permanent Vendor Master.` })
    } catch (err) {
      setMoveError(err?.response?.data?.message ?? 'Failed to move vendor. Please try again.')
    } finally {
      setMovingId(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">One-Time Vendors</h2>
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={() => { setShowArchived(false); setPage(1) }}
              className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold px-4 py-2 transition-colors select-none ${
                !showArchived
                  ? 'bg-amber-50 ring-1 ring-amber-200 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {workflow.requests.filter(r => r.isOneTimeVendor && !r.isArchived && r.status === 'Completed').length} One-Time Vendor{workflow.requests.filter(r => r.isOneTimeVendor && !r.isArchived && r.status === 'Completed').length !== 1 ? 's' : ''}
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
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search vendor, GST, city…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="form-input pl-9 text-sm max-w-xs"
          />
        </div>
      </div>

      {moveError && (
        <div className="text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{moveError}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="text-sm" style={{ minWidth: '750px', width: '100%' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
              {['Vendor Name', 'Status', 'City', 'GST Number', 'Submitted On', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  {showArchived ? 'No archived one-time vendors.' : 'No one-time vendor requests found.'}
                </td>
              </tr>
            )}
            {paginated.map(req => (
              <tr key={req.id} className="hover:bg-gray-50 transition-colors divide-x divide-gray-200">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{req.vendorName}</p>
                  <p className="text-xs text-gray-400">{req.contactPerson}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={req.status} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {[req.city, req.locality].filter(Boolean).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{req.gstNumber || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      className="btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() => setViewing(req)}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isAdmin && req.status === 'Completed' && !showArchived && (
                      <button
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        onClick={() => handleMoveToPermanent(req)}
                        disabled={movingId === req.id}
                        title="Move to Permanent Vendor Master"
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        {movingId === req.id ? 'Moving…' : 'Move to Permanent'}
                      </button>
                    )}
                    {isAdmin && req.status === 'Completed' && !showArchived && (
                      <button
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
                        onClick={() => { setArchiving(req); setArchiveError(null) }}
                        title="Archive this one-time vendor — record is retained and can be restored"
                      >
                        <ArchiveBoxIcon className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    )}
                    {isAdmin && showArchived && (
                      <button
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
                        onClick={() => { setRestoring(req); setRestoreError(null) }}
                        title="Restore this one-time vendor"
                      >
                        <ArrowPathIcon className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer / pagination */}
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {filtered.length === 0
                ? 'No records'
                : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <PageSizeSelect value={pageSize} onChange={v => { setPageSize(v); setPage(1) }} />
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 px-1">Page {page} of {totalPages}</span>
              <button
                className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {viewing && <VendorDetailModal request={viewing} onClose={() => setViewing(null)} />}

      {/* Archive confirmation modal */}
      {archiving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Archive this one-time vendor?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{archiving.vendorName}</strong> will be removed from the One-Time Vendors list.
              The full record is retained and can be restored by an admin at any time.
            </p>
            {archiveError && (
              <p className="text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{archiveError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setArchiving(null)} disabled={archiveLoading}>
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

      {/* Restore confirmation modal */}
      {restoring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Restore this one-time vendor?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>{restoring.vendorName}</strong> will be restored to the One-Time Vendors list.
            </p>
            {restoreError && (
              <p className="text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{restoreError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setRestoring(null)} disabled={restoreLoading}>
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60"
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

      {toast && <Toast type={toast.type} title={toast.title} body={toast.body} onClose={() => setToast(null)} />}
    </div>
  )
}

// ── Welcome screen shown for ~3s after login ──────────────────────────────────

function WelcomeScreen({ user, onDone }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100)
    const t2 = setTimeout(() => setPhase(2), 2800)
    const t3 = setTimeout(() => onDone(),    3500)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [onDone])

  const roleLabel = {
    [ROLES.Admin]:         'Administrator',
    [ROLES.Buyer]:         'Buyer',
    [ROLES.Approver]:      'Approver',
    [ROLES.FinalApprover]: 'Final Approver',
  }[user.role] ?? user.role

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #064e80 0%, #096fb3 50%, #053e66 100%)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
        opacity:    phase === 2 ? 0 : 1,
        transform:  phase === 2 ? 'scale(1.04)' : 'scale(1)',
      }}
    >
      {/* Background grid */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wgrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wgrid)" />
      </svg>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full border border-white/10 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full border border-white/10 translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      <div
        className="relative z-10 text-center px-8"
        style={{
          transition: 'opacity 0.8s ease, transform 0.8s ease',
          opacity:    phase >= 1 ? 1 : 0,
          transform:  phase >= 1 ? 'translateY(0)' : 'translateY(24px)',
        }}
      >
        <div className="text-center mb-10">
          <p className="text-white mb-1"
            style={{ fontFamily: "'Barlow Condensed', 'Arial Black', Arial, sans-serif", fontWeight: 900, fontSize: '2.4rem', letterSpacing: '0.18em' }}>
            ANDRITZ
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-10 bg-white/20" />
            <span className="text-white/60 text-xs font-bold tracking-[0.5em] uppercase">KYC</span>
            <div className="h-px w-10 bg-white/20" />
          </div>
          <p className="text-white/30 text-[9px] tracking-[0.2em] uppercase mt-1.5">Vendor Onboarding &amp; Compliance</p>
        </div>
        <p className="text-white/50 text-sm font-medium uppercase tracking-[0.3em] mb-3">Welcome back</p>
        <h1 className="text-white font-bold mb-4" style={{ fontSize: '2.2rem' }}>{user.name}</h1>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-semibold mb-12 bg-white/10 border border-white/20">
          <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
          {roleLabel}
        </div>
        <div className="w-48 mx-auto h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full welcome-progress" style={{ background: 'linear-gradient(90deg, #096fb3, white)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Session-expired banner ────────────────────────────────────────────────────

function SessionExpiredBanner({ onDone }) {
  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-between px-6 py-3 bg-red-600 text-white text-sm font-medium shadow-lg">
      <span>Your session has expired. Please sign in again to continue.</span>
      <button
        onClick={onDone}
        className="ml-4 px-3 py-1 rounded bg-white text-red-600 font-semibold hover:bg-red-50 transition-colors"
      >
        Sign In
      </button>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const { currentUser, isAuthenticated, logout, updateUser, showWelcome, dismissWelcome } = useAuth()
  const workflow = useVendorWorkflow()
  const [activePage,      setActivePage]      = useState('dashboard')
  const [sessionExpired,  setSessionExpired]  = useState(false)

  // Listen for the 401 event fired by api.js interceptor
  useEffect(() => {
    const handler = () => setSessionExpired(true)
    window.addEventListener('session-expired', handler)
    return () => window.removeEventListener('session-expired', handler)
  }, [])

  function handleSessionExpiredDone() {
    setSessionExpired(false)
    logout()
    setActivePage('dashboard')
  }

  if (!isAuthenticated) return <Login />

  const role = currentUser.role

  function renderPage() {
    if (activePage === 'settings') {
      return <SettingsPage currentUser={currentUser} onUpdate={updateUser} />
    }
    if (activePage === 'onetime' && (role === ROLES.Admin || role === ROLES.FinalApprover)) {
      return <OneTimeVendorPage workflow={workflow} currentUser={currentUser} />
    }
    if (role === ROLES.Buyer) {
      return <BuyerConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === ROLES.Approver) {
      return <ApproverConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === ROLES.FinalApprover) {
      return <FinalApproverConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === ROLES.Admin) {
      return <AdminConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    return null
  }

  return (
    <>
      {sessionExpired && <SessionExpiredBanner onDone={handleSessionExpiredDone} />}
      {showWelcome && <WelcomeScreen user={currentUser} onDone={dismissWelcome} />}
      <AppShell
        workflow={workflow}
        currentUser={currentUser}
        onLogout={() => { logout(); setActivePage('dashboard') }}
        activePage={activePage}
        setActivePage={setActivePage}
      >
        {renderPage()}
      </AppShell>
    </>
  )
}
