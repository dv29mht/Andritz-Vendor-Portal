import { useEffect } from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/solid'

const VARIANTS = {
  success: {
    wrap: 'bg-white ring-emerald-200',
    icon: <CheckCircleIcon className="h-6 w-6 text-emerald-500 flex-shrink-0" />,
    bar:  'bg-emerald-500',
  },
  error: {
    wrap: 'bg-white ring-red-200',
    icon: <ExclamationCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0" />,
    bar:  'bg-red-500',
  },
  warning: {
    wrap: 'bg-white ring-amber-200',
    icon: <ExclamationTriangleIcon className="h-6 w-6 text-amber-500 flex-shrink-0" />,
    bar:  'bg-amber-500',
  },
}

/**
 * @param {{ title: string, body?: string }} message
 * @param {'success'|'error'|'warning'} type
 * @param {() => void} onClose
 * @param {number} [duration=4500]
 */
export default function Toast({ message, title, body, type = 'success', onClose, duration = 4500 }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [onClose, duration])

  const v = VARIANTS[type] ?? VARIANTS.success
  const heading = message?.title ?? title
  const detail  = message?.body  ?? body

  // A top-centered notification card — deliberately NOT a full-screen
  // backdrop-blur overlay. The old overlay sat on top of (and blurred) whatever
  // was animating underneath — a closing modal, a refreshing dashboard — which
  // read as a "flash" right before the toast settled. A lightweight card that
  // slides in cleanly avoids fighting with those background transitions. The
  // wrapper ignores pointer events so it never blocks the UI behind it.
  return (
    <div className="fixed top-5 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
      <div className={`toast-enter relative pointer-events-auto flex items-start gap-3.5 rounded-2xl
                       shadow-2xl ring-1 px-5 py-4 max-w-sm w-full ${v.wrap}`}
           role="alert"
      >
        {v.icon}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{heading}</p>
          {detail && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{detail}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div
          className={`absolute bottom-0 left-0 h-1 rounded-b-2xl ${v.bar} origin-left`}
          style={{ animation: `shrink ${duration}ms linear forwards` }}
        />

        <style>{`
          @keyframes shrink {
            from { width: 100%; }
            to   { width: 0%; }
          }
          @keyframes toastIn {
            from { opacity: 0; transform: translateY(-12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .toast-enter { animation: toastIn 220ms cubic-bezier(0.16, 1, 0.3, 1); }
        `}</style>
      </div>
    </div>
  )
}
