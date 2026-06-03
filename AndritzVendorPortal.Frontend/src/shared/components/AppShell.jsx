import { useState } from 'react'
import {
  HomeIcon, DocumentTextIcon, ClockIcon, ArchiveBoxIcon,
  ExclamationCircleIcon, BuildingOfficeIcon, TableCellsIcon,
  UserGroupIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon,
  ChevronLeftIcon, Bars3Icon, StarIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import NotificationBell from '../../features/notifications/components/NotificationBell'
import { useNotifications } from '../../features/notifications/hooks/useNotifications'
import AndritzLogo from './AndritzLogo'
import ConfirmDialog from './ConfirmDialog'

const NAV = {
  Buyer: [
    { id: 'dashboard', label: 'Dashboard',        icon: HomeIcon },
    { id: 'requests',  label: 'My Requests',      icon: DocumentTextIcon },
    { id: 'revision',  label: 'Awaiting Revision', icon: ExclamationCircleIcon },
    { id: 'settings',  label: 'Settings',          icon: Cog6ToothIcon },
  ],
  Approver: [
    { id: 'dashboard', label: 'Dashboard',        icon: HomeIcon },
    { id: 'pending',   label: 'Pending Approval', icon: ClockIcon },
    { id: 'waiting',   label: 'Awaiting Revision', icon: ExclamationCircleIcon },
    { id: 'history',   label: 'History',          icon: ArchiveBoxIcon },
    { id: 'settings',  label: 'Settings',          icon: Cog6ToothIcon },
  ],
  // Single elevated account: the Final Approver now also holds every former admin
  // capability, so this nav is the union of the old Admin + Final Approver menus.
  // ConsoleRoute dispatches each page to the console that owns it.
  FinalApprover: [
    { id: 'dashboard',       label: 'Dashboard',         icon: HomeIcon },
    { id: 'requests',        label: 'All Requests',      icon: TableCellsIcon },
    { id: 'pending',         label: 'Pending Queue',     icon: ClockIcon },
    { id: 'history',         label: 'History',           icon: ArchiveBoxIcon },
    { id: 'vendors',         label: 'Permanent Vendors', icon: BuildingOfficeIcon },
    { id: 'onetime',         label: 'One-Time Vendors',  icon: StarIcon },
    { id: 'users',           label: 'User Management',   icon: UserGroupIcon },
    { id: 'email-templates', label: 'Email Templates',   icon: EnvelopeIcon },
    { id: 'settings',        label: 'Settings',           icon: Cog6ToothIcon },
  ],
}

const ROLE_LABELS = {
  Buyer: 'Buyer', Approver: 'Approver', FinalApprover: 'Final Approver + Admin',
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
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  const { notifications, unreadCount, markOneRead, markOneUnread, markAllRead } = useNotifications(
    workflow.requests, currentUser.id, role
  )

  const sidebarW = collapsed ? 'w-14' : 'w-52'
  const mainML   = collapsed ? 'ml-14' : 'ml-52'

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarW} fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-200`}
        style={{ background: SIDEBAR_BG }}
      >
        {/* Logo */}
        <div className={`flex items-center border-b flex-shrink-0 ${
          collapsed ? 'justify-center px-0 h-14' : 'justify-between px-4 h-14'
        }`}
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          {!collapsed && (
            <div className="flex flex-col gap-1 min-w-0">
              <AndritzLogo white className="h-4 w-auto" style={{ maxWidth: '108px' }} />
              <span className="text-white/50 text-[8px] font-semibold tracking-[0.18em] uppercase leading-none whitespace-nowrap">
                Supplier Connect
              </span>
            </div>
          )}
          {collapsed && (
            <img
              src="/andritz-a.png"
              alt="Andritz"
              draggable={false}
              style={{
                height: 26,
                width: 'auto',
                filter: 'brightness(0) invert(1)',
              }}
            />
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

        {/* Signed-in user (collapsed state) — Sign out lives in the top header now */}
        {collapsed && (
          <div className="px-2 py-3 flex justify-center" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ background: ACTIVE_BG }}>
              {getInitials(currentUser.name)}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className={`flex-1 ${mainML} flex flex-col min-h-screen transition-all duration-200 min-w-0`}>

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
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
              {activeItem?.label ?? 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-white"
              style={{ background: role === 'FinalApprover' ? '#dc2626' : ACTIVE_BG }}>
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
            <div className="w-px h-5 bg-gray-200" />
            <button
              onClick={() => setConfirmSignOut(true)}
              title="Sign out"
              className="inline-flex items-center gap-1.5 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              <span className="hidden lg:inline text-sm font-medium">Sign out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto" style={{ minWidth: 0 }}>
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        confirmIcon={ArrowRightOnRectangleIcon}
        confirmTone="red"
        onCancel={() => setConfirmSignOut(false)}
        onConfirm={() => { setConfirmSignOut(false); onLogout?.() }}
      >
        <p className="text-sm text-gray-600">
          You'll be returned to the login page and will need to sign in again to continue.
        </p>
      </ConfirmDialog>
    </div>
  )
}
