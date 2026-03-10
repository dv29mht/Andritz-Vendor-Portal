import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from './contexts/AuthContext'
import { useVendorWorkflow } from './hooks/useVendorWorkflow'
import Login from './pages/Login'
import BuyerConsole from './components/consoles/BuyerConsole'
import ApproverConsole from './components/consoles/ApproverConsole'
import FinalApproverConsole from './components/consoles/FinalApproverConsole'
import AdminConsole from './components/consoles/AdminConsole'

export default function App() {
  const { currentUser, isAuthenticated, logout } = useAuth()
  const workflow = useVendorWorkflow()

  if (!isAuthenticated) return <Login />

  const role = currentUser.role  // 'Admin' | 'Buyer' | 'Approver' | 'FinalApprover'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Global header */}
      <header className="bg-slate-900 text-white px-4 sm:px-8 py-0 flex items-center gap-4 shadow-lg h-14 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-1 bg-[#c8102e] rounded-full" />
          <span className="font-extrabold text-lg tracking-widest uppercase">ANDRITZ</span>
        </div>
        <div className="h-5 w-px bg-white/20" />
        <span className="text-sm text-slate-300 font-medium">Vendor Registration Portal</span>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white leading-none">{currentUser.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{role}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            title="Sign out"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Role console */}
      <main className="flex-1 overflow-y-auto">
        {role === 'Admin'         && <AdminConsole         workflow={workflow} />}
        {role === 'Buyer'         && <BuyerConsole         workflow={workflow} currentUser={currentUser} />}
        {role === 'Approver'      && <ApproverConsole      workflow={workflow} currentUser={currentUser} />}
        {role === 'FinalApprover' && <FinalApproverConsole workflow={workflow} currentUser={currentUser} />}
      </main>
    </div>
  )
}
