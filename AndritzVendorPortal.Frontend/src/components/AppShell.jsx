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

// Inline SVG logo mark — stylised "A" with slash accent
function AndritzMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="5" fill="#096fb3" />
      <text x="14" y="21" textAnchor="middle" fill="white"
        fontSize="16" fontWeight="900" fontFamily="Arial Black, Arial, sans-serif">A</text>
      {/* lightning slash */}
      <line x1="17" y1="6" x2="14" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

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
    <div className="flex min-h-screen" style={{ background: '#f1f5f9' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarW} fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-200`}
        style={{ background: '#0f172a' }}
      >
        {/* Logo */}
        <div className={`flex items-center border-b border-white/10 h-16 flex-shrink-0 ${
          collapsed ? 'justify-center px-0' : 'justify-between px-4'
        }`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <AndritzMark size={30} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-white font-extrabold tracking-[0.18em] text-sm leading-none">ANDRITZ</span>
                  <span className="text-[#096fb3] font-extrabold text-sm leading-none tracking-widest">KYC</span>
                </div>
                <p className="text-white/30 text-[8.5px] tracking-wider uppercase mt-0.5 leading-none">
                  Vendor Onboarding &amp; Compliance
                </p>
              </div>
            </div>
          )}
          {collapsed && <AndritzMark size={28} />}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 ${collapsed ? 'hidden' : ''}`}
            title="Collapse sidebar"
          >
            <ChevronLeftIcon className="h-4 w-4" />
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
                    ? 'bg-[#096fb3] text-white shadow-md'
                    : 'text-white/55 hover:text-white hover:bg-white/8'
                }`}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3 border-t border-white/10">
          {collapsed && (
            <div className="flex justify-center mb-2">
              <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-white text-[10px] font-bold">
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
        <header className="bg-white border-b border-gray-200 px-5 h-14 flex items-center justify-between flex-shrink-0 sticky top-0 z-20">

          {/* Left: expand button (when collapsed) + breadcrumb */}
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
              <span className="text-gray-400 text-xs font-medium">{ROLE_LABELS[role] ?? role}</span>
              <ChevronRightIcon className="h-3 w-3 text-gray-300" />
              <span className="font-semibold text-gray-900 text-sm">{activeItem?.label ?? 'Dashboard'}</span>
            </div>
          </div>

          {/* Right: role badge + user avatar + notification bell */}
          <div className="flex items-center gap-3">
            {/* Role badge */}
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-white"
              style={{ background: '#096fb3' }}>
              {ROLE_LABELS[role] ?? role}
            </span>

            {/* User avatar + name */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: '#096fb3' }}>
                {getInitials(currentUser.name)}
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 leading-none">
                {currentUser.name}
              </span>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Notification bell */}
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkOneRead={markOneRead}
              onMarkAllRead={markAllRead}
              label="Notifications"
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
