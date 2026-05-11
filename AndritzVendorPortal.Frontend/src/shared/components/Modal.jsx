import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

const WIDTHS = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-5xl' }

export default function Modal({ title, onClose, children, size = 'md', open = true }) {
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className={`w-full ${WIDTHS[size]} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <DialogTitle className="text-base font-semibold text-gray-900">{title}</DialogTitle>
                  <button
                    onClick={onClose}
                    className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="overflow-y-auto px-6 py-5 flex-1">
                  {children}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
