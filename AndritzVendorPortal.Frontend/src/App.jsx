import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, ArchiveBoxIcon, ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline'
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

const OTV_PAGE_SIZE = 10

function OneTimeVendorPage({ workflow, currentUser }) {
  const isAdmin = currentUser?.role === 'Admin'
  const [viewing,          setViewing]          = useState(null)
  const [page,             setPage]             = useState(1)
  const [archiving,        setArchiving]        = useState(null)
  const [archiveLoading,   setArchiveLoading]   = useState(false)
  const [archiveError,     setArchiveError]     = useState(null)
  const [movingId,         setMovingId]         = useState(null)
  const [moveError,        setMoveError]        = useState(null)

  const oneTime    = workflow.requests.filter(r => r.isOneTimeVendor && !r.isArchived && r.status === 'Completed')
  const totalPages = Math.max(1, Math.ceil(oneTime.length / OTV_PAGE_SIZE))
  const paginated  = oneTime.slice((page - 1) * OTV_PAGE_SIZE, page * OTV_PAGE_SIZE)

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
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 ring-1 ring-amber-200 text-amber-700 text-sm font-semibold px-4 py-2 select-none">
              {oneTime.length} One-Time Vendor{oneTime.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {moveError && (
        <div className="text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{moveError}</div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Vendor Name', 'Status', 'City', 'GST Number', 'Submitted On', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No one-time vendor requests found.
                </td>
              </tr>
            )}
            {paginated.map(req => (
              <tr key={req.id} className="hover:bg-gray-50 transition-colors">
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      className="btn-secondary !py-1 !px-2 !text-xs"
                      onClick={() => setViewing(req)}
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isAdmin && req.status === 'Completed' && (
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
                    {isAdmin && req.status === 'Completed' && (
                      <button
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
                        onClick={() => { setArchiving(req); setArchiveError(null) }}
                        title="Archive this one-time vendor — record is retained and can be restored"
                      >
                        <ArchiveBoxIcon className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer / pagination */}
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {oneTime.length === 0
              ? 'No records'
              : `Showing ${(page - 1) * OTV_PAGE_SIZE + 1}–${Math.min(page * OTV_PAGE_SIZE, oneTime.length)} of ${oneTime.length}`}
          </span>
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
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (count <= 0) { onDone(); return }
    const t = setTimeout(() => setCount(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [count, onDone])

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center px-4 py-3 bg-red-600 text-white text-sm font-medium shadow-lg">
      Your session has expired. Redirecting to login in {count}s…
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
