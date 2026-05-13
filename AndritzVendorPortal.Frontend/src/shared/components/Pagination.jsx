import { ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline'

function pageRange(current, total) {
  const WINDOW = 1
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const head = [1]
  const tail = [total]
  const around = []
  for (let p = current - WINDOW; p <= current + WINDOW; p++) {
    if (p > 1 && p < total) around.push(p)
  }

  const out = []
  let prev = 0
  for (const n of [...head, ...around, ...tail]) {
    if (n === prev) continue
    if (prev && n - prev > 1) out.push(`gap-${prev}-${n}`)
    out.push(n)
    prev = n
  }
  return out
}

export default function Pagination({ page, totalPages, onPageChange, showFirstLast = true }) {
  if (totalPages <= 1) return null

  const pages = pageRange(page, totalPages)
  const btnBase = 'inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded text-xs transition-colors'
  const navBtn  = `${btnBase} text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`

  return (
    <div className="flex items-center gap-1">
      {showFirstLast && (
        <button
          className={navBtn}
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          title="First page"
          aria-label="First page"
        >
          <ChevronDoubleLeftIcon className="h-4 w-4" />
        </button>
      )}
      <button
        className={navBtn}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        title="Previous page"
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </button>

      {pages.map((p) => {
        if (typeof p === 'string') {
          return (
            <span key={p} className="px-1 text-xs text-gray-400 select-none">…</span>
          )
        }
        const active = p === page
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={active ? 'page' : undefined}
            className={`${btnBase} font-medium ${
              active
                ? 'bg-[#096fb3] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        )
      })}

      <button
        className={navBtn}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        title="Next page"
        aria-label="Next page"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </button>
      {showFirstLast && (
        <button
          className={navBtn}
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last page"
          aria-label="Last page"
        >
          <ChevronDoubleRightIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
