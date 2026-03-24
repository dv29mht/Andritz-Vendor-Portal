import { useState } from 'react'
import {
  HomeIcon, DocumentTextIcon, ClockIcon, ArchiveBoxIcon,
  ExclamationCircleIcon, BuildingOfficeIcon, TableCellsIcon,
  UserGroupIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon,
  ChevronRightIcon, ChevronLeftIcon, Bars3Icon,
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
  const [collapsed, setCollapsed] = useState(false)

  const { notifications, unreadCount, markOneRead, markAllRead } = useNotifications(
    workflow.requests, currentUser.id, role
  )

  const sidebarW = collapsed ? 'w-14' : 'w-56'
  const mainML   = collapsed ? 'ml-14' : 'ml-56'

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarW} fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-200`}
        style={{ background: '#0f172a' }}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center border-b border-white/10 h-14 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-5'}`}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="h-2 w-1 bg-[#096fb3] rounded-sm" />
                <div className="h-5 w-1 bg-white rounded-sm" />
              </div>
              <div>
                <p className="text-white font-extrabold tracking-[0.2em] text-sm leading-none">ANDRITZ</p>
                <p className="text-white/40 text-[9px] tracking-widest uppercase mt-0.5">Vendor Portal</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Bars3Icon className="h-5 w-5" /> : <ChevronLeftIcon className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activePage === id
            return (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                title={collapsed ? label : undefined}
                className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all text-left ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-[#096fb3] text-white shadow-lg'
                    : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && label}
              </button>
            )
          })}
        </nav>

        {/* User info + sign out */}
        <div className="px-2 py-3 border-t border-white/10 space-y-1">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {getInitials(currentUser.name)}
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold truncate leading-none">{currentUser.name}</p>
                <p className="text-white/40 text-[10px] mt-0.5">{ROLE_LABELS[role] ?? role}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center py-1">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs font-bold">
                {getInitials(currentUser.name)}
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`w-full flex items-center gap-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 text-xs font-medium transition-all py-2 ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className={`flex-1 ${mainML} flex flex-col min-h-screen transition-all duration-200`}>
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
            onMarkOneRead={markOneRead}
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
