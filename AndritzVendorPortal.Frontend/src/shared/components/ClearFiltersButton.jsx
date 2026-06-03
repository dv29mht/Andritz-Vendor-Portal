import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Small "Clear" button that appears only while a search term or date range is
 * active, so the user can wipe whatever they typed/picked in one click instead
 * of emptying each field by hand. Each filter row owns its own reset logic and
 * passes it via `onClear`; `active` controls visibility.
 */
export default function ClearFiltersButton({ active, onClear, className = '' }) {
  if (!active) return null
  return (
    <button
      type="button"
      onClick={onClear}
      title="Clear search and date filters"
      className={`inline-flex items-center gap-1 shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-colors ${className}`}
    >
      <XMarkIcon className="h-4 w-4" />
      Clear
    </button>
  )
}
