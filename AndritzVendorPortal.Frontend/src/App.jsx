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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
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
        <div className="flex items-center justify-center gap-3 mb-10">
          <svg width="40" height="40" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="5" fill="#096fb3" />
            <text x="14" y="21" textAnchor="middle" fill="white"
              fontSize="16" fontWeight="900" fontFamily="Arial Black, Arial, sans-serif">A</text>
            <line x1="17" y1="6" x2="14" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="text-left">
            <div className="flex items-baseline gap-2">
              <span className="text-white font-extrabold text-2xl tracking-[0.25em] leading-none">ANDRITZ</span>
              <span className="text-[#096fb3] font-extrabold text-2xl leading-none tracking-widest">KYC</span>
            </div>
            <p className="text-white/30 text-[9px] tracking-[0.25em] uppercase mt-1">Vendor Onboarding &amp; Compliance</p>
          </div>
        </div>
        <p className="text-white/50 text-sm font-medium uppercase tracking-[0.3em] mb-3">Welcome back</p>
        <h1 className="text-white font-bold mb-4" style={{ fontSize: '2.2rem' }}>{user.name}</h1>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-semibold mb-12 bg-white/10 border border-white/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#096fb3]" />
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
    if (role === 'Buyer') {
      return <BuyerConsole activePage={activePage} workflow={workflow} currentUser={currentUser} />
    }
    if (role === 'Approver') {
      return <ApproverConsole activePage={activePage} workflow={workflow} currentUser={currentUser} />
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
        onLogout={logout}
        activePage={activePage}
        setActivePage={setActivePage}
      >
        {renderPage()}
      </AppShell>
    </>
  )
}
