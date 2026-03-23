import { useState, useRef, useEffect } from 'react'
import { BellIcon } from '@heroicons/react/24/outline'
import { BellAlertIcon } from '@heroicons/react/24/solid'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)  return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const DOT = {
  success: 'bg-emerald-400',
  error:   'bg-red-400',
  info:    'bg-blue-400',
}

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, label = 'Notifications', variant = 'dark' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isLight = variant === 'light'

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    // Mark all read when opening if there are unread
    if (next && unreadCount > 0) onMarkAllRead()
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded-lg transition-colors ${
          isLight
            ? 'text-white/80 hover:text-white hover:bg-white/15'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
        title={label}
      >
        {unreadCount > 0
          ? <BellAlertIcon className={`h-5 w-5 ${isLight ? 'text-white' : 'text-blue-600'}`} />
          : <BellIcon className="h-5 w-5" />
        }
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-xl ring-1 ring-black/5 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
            {notifications.length > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <BellIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No activity yet</p>
              </div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`px-4 py-3 transition-colors ${n.isUnread ? 'bg-blue-50/60' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${DOT[n.type] ?? DOT.info}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
