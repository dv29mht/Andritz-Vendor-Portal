import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'

const TONES = {
  amber:   'bg-amber-600 hover:bg-amber-700',
  red:     'bg-red-600 hover:bg-red-700',
  blue:    'bg-[#096fb3] hover:bg-[#075d99]',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
}

/**
 * A small confirmation modal built on Headless UI Dialog.
 * Focus trap, ESC handling, and ARIA wiring come from Headless UI.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  confirmIcon: ConfirmIcon,
  confirmTone  = 'blue',
  loading      = false,
  error        = null,
  onConfirm,
  onCancel,
}) {
  return (
    <Transition appear show={!!open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => !loading && onCancel?.()}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
                {children}
                {error && (
                  <p className="text-xs text-red-600 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button className="btn-secondary" onClick={onCancel} disabled={loading}>
                    {cancelLabel}
                  </button>
                  <button
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-60 ${TONES[confirmTone] ?? TONES.blue}`}
                    onClick={onConfirm}
                    disabled={loading}
                  >
                    {ConfirmIcon && <ConfirmIcon className="h-4 w-4" />}
                    {confirmLabel}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
