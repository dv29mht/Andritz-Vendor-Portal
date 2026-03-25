import { useState, useRef, useEffect } from 'react'
import { BellIcon, CheckIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
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

export default function NotificationBell({ notifications, unreadCount, onMarkOneRead, onMarkOneUnread, onMarkAllRead, label = 'Notifications', variant = 'dark' }) {
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

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-lg transition-colors ${
          isLight
            ? 'text-white/80 hover:text-white hover:bg-white/15'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
        title={label}
      >
        {unreadCount > 0
          ? <BellAlertIcon className={`h-5 w-5 ${isLight ? 'text-white' : 'text-[#096fb3]'}`} />
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
            <h3 className="text-sm font-semibold text-gray-900">
              {label}
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-[#096fb3] hover:text-[#075d99] font-medium transition-colors"
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
                  {n.isUnread ? (
                    <button
                      onClick={() => onMarkOneRead(n.id)}
                      title="Mark as read"
                      className="flex-shrink-0 mt-1 p-1 rounded-full text-[#096fb3]/60 hover:text-[#096fb3] hover:bg-[#096fb3]/10 transition-colors"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onMarkOneUnread(n.id)}
                      title="Mark as unread"
                      className="flex-shrink-0 mt-1 p-1 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <ArrowUturnLeftIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
