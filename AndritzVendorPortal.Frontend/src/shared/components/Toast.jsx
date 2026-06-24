import { useEffect, useState } from 'react'
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
 * Centered toast over a blurred dim backdrop.
 *
 * @param {{ title: string, body?: string }} message
 * @param {'success'|'error'|'warning'} type
 * @param {() => void} onClose
 * @param {number} [duration=4500]  How long the toast stays up once visible.
 * @param {number} [openDelay=220]  Hold-back before the toast appears.
 *
 * Why the delay: submissions call setToast in the same render that closes the
 * form modal. Without it, the blurred backdrop snapped on while the modal was
 * still animating closed (and the dashboard behind it was re-rendering), so that
 * motion showed through the blur as a "flash". Waiting out the modal's ~150ms
 * leave animation lets the backdrop fade in over a settled screen instead.
 */
export default function Toast({ message, title, body, type = 'success', onClose, duration = 4500, openDelay = 220 }) {
  const [visible, setVisible] = useState(false)

  // Hold the toast back until the form modal (if any) has finished closing.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), openDelay)
    return () => clearTimeout(t)
  }, [openDelay])

  // Auto-dismiss only starts counting once the toast is actually on screen.
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [visible, onClose, duration])

  if (!visible) return null

  const v = VARIANTS[type] ?? VARIANTS.success
  const heading = message?.title ?? title
  const detail  = message?.body  ?? body

  return (
    <div className="toast-backdrop fixed inset-0 z-[60] flex items-center justify-center px-4 backdrop-blur-sm bg-black/20">
      <div className={`toast-enter relative flex items-start gap-3.5 rounded-2xl
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
          @keyframes toastBackdropIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes toastIn {
            from { opacity: 0; transform: scale(0.96); }
            to   { opacity: 1; transform: scale(1); }
          }
          .toast-backdrop { animation: toastBackdropIn 200ms ease-out; }
          .toast-enter    { animation: toastIn 220ms cubic-bezier(0.16, 1, 0.3, 1); }
        `}</style>
      </div>
    </div>
  )
}
