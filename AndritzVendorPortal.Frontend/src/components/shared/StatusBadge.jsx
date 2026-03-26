import clsx from 'clsx'

const CONFIG = {
  Draft:                { label: 'Draft',        cls: 'bg-gray-100   text-gray-600   ring-gray-200'   },
  PendingApproval:      { label: 'Pending',      cls: 'bg-amber-50   text-amber-700  ring-amber-200'  },
  PendingFinalApproval: { label: 'Final Review', cls: 'bg-blue-50    text-blue-700   ring-blue-200'   },
  Rejected:             { label: 'Rejected',     cls: 'bg-red-50     text-red-700    ring-red-200'    },
  Completed:            { label: 'Completed',    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200'},
}

export default function StatusBadge({ status, size = 'sm' }) {
  const { label, cls } = CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 ring-gray-200' }
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      cls
    )}>
      {label}
    </span>
  )
}

// Decision dot used in approval timeline
export function DecisionDot({ decision }) {
  const map = {
    Approved: 'bg-emerald-500',
    Rejected: 'bg-red-500',
    Pending:  'bg-gray-300',
  }
  return (
    <span className={clsx('inline-block h-2.5 w-2.5 rounded-full flex-shrink-0', map[decision] ?? 'bg-gray-300')} />
  )
}
