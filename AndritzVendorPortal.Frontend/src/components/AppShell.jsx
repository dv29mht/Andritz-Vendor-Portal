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
    { id: 'settings',  label: 'Settings',          icon: Cog6ToothIcon },
  ],
}

const ROLE_LABELS = {
  Admin: 'Administrator', Buyer: 'Buyer',
  Approver: 'Approver', FinalApprover: 'Final Approver',
}

const getInitials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

// Deep Andritz navy — dark enough for white text contrast, clearly blue (not charcoal)
const SIDEBAR_BG = '#064e80'
// Active highlight — the lighter primary blue
const ACTIVE_BG  = '#096fb3'

export default function AppShell({ workflow, currentUser, onLogout, activePage, setActivePage, children }) {
  const role = currentUser.role
  const navItems = NAV[role] ?? []
  const activeItem = navItems.find(n => n.id === activePage)
  const [collapsed, setCollapsed] = useState(false)

  const { notifications, unreadCount, markOneRead, markOneUnread, markAllRead } = useNotifications(
    workflow.requests, currentUser.id, role
  )

  const sidebarW = collapsed ? 'w-14' : 'w-56'
  const mainML   = collapsed ? 'ml-14' : 'ml-56'

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarW} fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-200`}
        style={{ background: SIDEBAR_BG }}
      >
        {/* Logo */}
        <div className={`flex items-center border-b h-16 flex-shrink-0 ${
          collapsed ? 'justify-center px-0' : 'justify-between px-4'
        }`}
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white leading-none"
                style={{ fontFamily: "'Barlow Condensed', 'Arial Black', Arial, sans-serif", fontWeight: 800, fontSize: '18px', letterSpacing: '0.06em', WebkitFontSmoothing: 'antialiased' }}>
                ANDRITZ
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-white/70 text-[9px] font-bold tracking-[0.4em] uppercase">KYC</span>
                <span className="text-white/25 text-[8px]">·</span>
                <span className="text-white/45 text-[8px] tracking-wider uppercase">Vendor Onboarding</span>
              </div>
            </div>
          )}
          {collapsed && (
            <span className="text-white"
              style={{ fontFamily: "'Barlow Condensed', 'Arial Black', Arial, sans-serif", fontWeight: 900, fontSize: '15px', letterSpacing: '0.08em' }}>A</span>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md transition-colors flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.45)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
              title="Collapse sidebar"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}
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
                }`}
                style={isActive
                  ? { background: ACTIVE_BG, color: 'white', fontWeight: 600 }
                  : { color: 'rgba(255,255,255,0.82)' }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {collapsed && (
            <div className="flex justify-center mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: ACTIVE_BG }}>
                {getInitials(currentUser.name)}
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`w-full flex items-center gap-2.5 rounded-lg text-xs font-medium transition-all py-2 ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
            style={{ color: 'rgba(255,255,255,0.5)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className={`flex-1 ${mainML} flex flex-col min-h-screen transition-all duration-200`}>

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-5 h-14 flex items-center justify-between flex-shrink-0 sticky top-0 z-20">

          <div className="flex items-center gap-3">
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Expand sidebar"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setActivePage('dashboard')}
                className="text-gray-400 text-xs font-medium hover:text-[#096fb3] transition-colors"
              >
                {ROLE_LABELS[role] ?? role}
              </button>
              <ChevronRightIcon className="h-3 w-3 text-gray-300" />
              <span className="font-semibold text-gray-900">{activeItem?.label ?? 'Dashboard'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-white"
              style={{ background: ACTIVE_BG }}>
              {ROLE_LABELS[role] ?? role}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: ACTIVE_BG }}>
                {getInitials(currentUser.name)}
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {currentUser.name}
              </span>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkOneRead={markOneRead}
              onMarkOneUnread={markOneUnread}
              onMarkAllRead={markAllRead}
              label="Notifications"
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
