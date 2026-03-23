import { useState, useEffect, useRef } from 'react'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from './contexts/AuthContext'
import { useVendorWorkflow } from './hooks/useVendorWorkflow'
import Login from './pages/Login'
import BuyerConsole from './components/consoles/BuyerConsole'
import ApproverConsole from './components/consoles/ApproverConsole'
import FinalApproverConsole from './components/consoles/FinalApproverConsole'
import AdminConsole from './components/consoles/AdminConsole'

// ── Welcome screen shown for ~3s after login ──────────────────────────────────

function WelcomeScreen({ user, onDone }) {
  const [phase, setPhase] = useState(0) // 0=entering 1=showing 2=exiting

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

  const roleColor = {
    Admin: '#a855f7', Buyer: '#0062AC',
    Approver: '#6366f1', FinalApprover: '#e8182c',
  }[user.role] ?? '#0062AC'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #001228 0%, #001d3d 40%, #0062AC 100%)',
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

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full border border-white/10 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full border border-white/10 translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {/* Center content */}
      <div
        className="relative z-10 text-center px-8"
        style={{
          transition: 'opacity 0.8s ease, transform 0.8s ease',
          opacity:    phase >= 1 ? 1 : 0,
          transform:  phase >= 1 ? 'translateY(0)' : 'translateY(24px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex flex-col gap-0.5">
            <div className="h-2.5 w-1.5 bg-[#e8182c] rounded-sm" />
            <div className="h-6 w-1.5 bg-white rounded-sm" />
          </div>
          <span className="text-white font-extrabold text-3xl tracking-[0.3em]">ANDRITZ</span>
        </div>

        {/* Welcome text */}
        <p className="text-white/50 text-sm font-medium uppercase tracking-[0.3em] mb-3">
          Welcome back
        </p>
        <h1 className="text-white font-bold mb-4" style={{ fontSize: '2.2rem' }}>
          {user.name}
        </h1>

        {/* Role badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-semibold mb-12"
          style={{ background: roleColor + '33', border: `1px solid ${roleColor}66` }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: roleColor }} />
          {roleLabel}
        </div>

        {/* Progress bar */}
        <div className="w-48 mx-auto h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full welcome-progress"
            style={{ background: `linear-gradient(90deg, ${roleColor}, white)` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const { currentUser, isAuthenticated, logout } = useAuth()
  const workflow = useVendorWorkflow()
  const [showWelcome, setShowWelcome] = useState(false)
  const prevAuth = useRef(false)

  useEffect(() => {
    if (isAuthenticated && !prevAuth.current) {
      setShowWelcome(true)
    }
    prevAuth.current = isAuthenticated
  }, [isAuthenticated])

  if (!isAuthenticated) return <Login />

  const role = currentUser.role

  return (
    <>
      {showWelcome && (
        <WelcomeScreen user={currentUser} onDone={() => setShowWelcome(false)} />
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Global header */}
        <header className="bg-[#0062AC] text-white px-4 sm:px-8 py-0 flex items-center gap-4 shadow-lg h-14 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col gap-0.5">
              <div className="h-1.5 w-0.5 bg-[#e8182c] rounded-sm" />
              <div className="h-4 w-0.5 bg-white/70 rounded-sm" />
            </div>
            <span className="font-extrabold text-lg tracking-widest uppercase">ANDRITZ</span>
          </div>
          <div className="h-5 w-px bg-white/20" />
          <span className="text-sm text-blue-100 font-medium">Vendor Registration Portal</span>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white leading-none">{currentUser.name}</p>
              <p className="text-xs text-blue-200 mt-0.5">{role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {role === 'Admin'         && <AdminConsole         workflow={workflow} currentUser={currentUser} />}
          {role === 'Buyer'         && <BuyerConsole         workflow={workflow} currentUser={currentUser} />}
          {role === 'Approver'      && <ApproverConsole      workflow={workflow} currentUser={currentUser} />}
          {role === 'FinalApprover' && <FinalApproverConsole workflow={workflow} currentUser={currentUser} />}
        </main>
      </div>
    </>
  )
}
