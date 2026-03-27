import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
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

function OneTimeVendorPage({ workflow }) {
  const [viewing, setViewing] = useState(null)
  const oneTime = workflow.requests.filter(r => r.isOneTimeVendor)
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 ring-1 ring-amber-200 text-amber-700 text-sm font-semibold px-4 py-2 select-none">
          {oneTime.length} One-Time Vendor{oneTime.length !== 1 ? 's' : ''}
        </span>
      </div>
      {oneTime.length === 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No one-time vendor requests found.</p>
        </div>
      )}
      {oneTime.map(req => (
        <div key={req.id} className="bg-white rounded-xl ring-1 ring-gray-200 px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-semibold text-gray-900">{req.vendorName}</p>
              <StatusBadge status={req.status} />
              <span className="text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 ring-inset px-2 py-0.5 rounded-full font-medium">One-Time</span>
              {req.vendorCode && (
                <span className="text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset px-2 py-0.5 rounded-full font-mono">{req.vendorCode}</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{req.contactPerson}{req.telephone ? ` · ${req.telephone}` : ''}</p>
            <p className="text-xs text-gray-400 mt-0.5">{[req.city, req.locality, req.state].filter(Boolean).join(', ')} · {req.materialGroup || '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">Submitted by {req.createdByName} · {new Date(req.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
          </div>
          <button className="btn-secondary flex-shrink-0" onClick={() => setViewing(req)}>
            View
          </button>
        </div>
      ))}
      {viewing && <VendorDetailModal request={viewing} onClose={() => setViewing(null)} />}
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
    Admin: 'Administrator', Buyer: 'Buyer',
    Approver: 'Approver', FinalApprover: 'Final Approver',
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

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const { currentUser, isAuthenticated, logout, updateUser, showWelcome, dismissWelcome } = useAuth()
  const workflow = useVendorWorkflow()
  const [activePage, setActivePage] = useState('dashboard')

  if (!isAuthenticated) return <Login />

  const role = currentUser.role

  function renderPage() {
    if (activePage === 'settings') {
      return <SettingsPage currentUser={currentUser} onUpdate={updateUser} />
    }
    if (activePage === 'onetime' && (role === 'Admin' || role === 'FinalApprover')) {
      return <OneTimeVendorPage workflow={workflow} />
    }
    if (role === 'Buyer') {
      return <BuyerConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === 'Approver') {
      return <ApproverConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === 'FinalApprover') {
      return <FinalApproverConsole activePage={activePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === 'Admin') {
      return <AdminConsole activePage={activePage} onNavigate={setActivePage} workflow={workflow} currentUser={currentUser} />
    }
    return null
  }

  return (
    <>
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
