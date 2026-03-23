import {
  HomeIcon, DocumentTextIcon, ClockIcon, ArchiveBoxIcon,
  ExclamationCircleIcon, BuildingOfficeIcon, TableCellsIcon,
  UserGroupIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import NotificationBell from './shared/NotificationBell'
import { useNotifications } from '../hooks/useNotifications'

const NAV = {
  Buyer: [
    { id: 'dashboard', label: 'Dashboard',        icon: HomeIcon },
    { id: 'requests',  label: 'My Requests',      icon: DocumentTextIcon },
    { id: 'revision',  label: 'Waiting Revision', icon: ExclamationCircleIcon },
    { id: 'settings',  label: 'Settings',          icon: Cog6ToothIcon },
  ],
  Approver: [
    { id: 'dashboard', label: 'Dashboard',        icon: HomeIcon },
    { id: 'pending',   label: 'Pending Approval', icon: ClockIcon },
    { id: 'waiting',   label: 'Waiting Revision', icon: ExclamationCircleIcon },
    { id: 'history',   label: 'History',          icon: ArchiveBoxIcon },
    { id: 'settings',  label: 'Settings',          icon: Cog6ToothIcon },
  ],
  FinalApprover: [
    { id: 'dashboard', label: 'Dashboard',        icon: HomeIcon },
    { id: 'pending',   label: 'Pending Queue',    icon: ClockIcon },
    { id: 'history',   label: 'History',          icon: ArchiveBoxIcon },
    { id: 'vendors',   label: 'Vendor Database',  icon: BuildingOfficeIcon },
    { id: 'settings',  label: 'Settings',          icon: Cog6ToothIcon },
  ],
  Admin: [
    { id: 'dashboard', label: 'Dashboard',        icon: HomeIcon },
    { id: 'requests',  label: 'All Requests',     icon: TableCellsIcon },
    { id: 'vendors',   label: 'Vendor Database',  icon: BuildingOfficeIcon },
    { id: 'users',     label: 'User Management',  icon: UserGroupIcon },
  ],
}

const ROLE_LABELS = {
  Admin: 'Administrator', Buyer: 'Buyer',
  Approver: 'Approver', FinalApprover: 'Final Approver',
}

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

export default function AppShell({ workflow, currentUser, onLogout, activePage, setActivePage, children }) {
  const role = currentUser.role
  const navItems = NAV[role] ?? []
  const activeItem = navItems.find(n => n.id === activePage)

  const { notifications, unreadCount, markAllRead } = useNotifications(
    workflow.requests, currentUser.id, role
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-56 fixed inset-y-0 left-0 z-30 flex flex-col" style={{ background: '#0f172a' }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="h-2 w-1 bg-[#c8102e] rounded-sm" />
              <div className="h-5 w-1 bg-white rounded-sm" />
            </div>
            <div>
              <p className="text-white font-extrabold tracking-[0.2em] text-sm leading-none">ANDRITZ</p>
              <p className="text-white/40 text-[9px] tracking-widest uppercase mt-0.5">Vendor Portal</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id
            return (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-[#c8102e] text-white shadow-lg'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {label}
              </button>
            )
          })}
        </nav>

        {/* User info + sign out */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {getInitials(currentUser.name)}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-none">{currentUser.name}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{ROLE_LABELS[role] ?? role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 text-xs font-medium transition-all"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 text-xs">{ROLE_LABELS[role] ?? role}</span>
            <ChevronRightIcon className="h-3 w-3 text-gray-300" />
            <span className="font-semibold text-gray-900">{activeItem?.label ?? 'Dashboard'}</span>
          </div>
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            onMarkAllRead={markAllRead}
            label="Notifications"
          />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
