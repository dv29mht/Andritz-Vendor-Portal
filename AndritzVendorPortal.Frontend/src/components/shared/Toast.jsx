import { useEffect } from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'

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
}

/**
 * @param {{ title: string, body?: string }} message
 * @param {'success'|'error'} type
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

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3.5 rounded-2xl
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
      `}</style>
    </div>
  )
}
