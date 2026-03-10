import clsx from 'clsx'
import { USERS } from '../data/mockData'

const ROLES = [
  { key: 'admin',        label: 'Admin',         user: USERS.admin,        color: 'purple' },
  { key: 'buyer',        label: 'Buyer',          user: USERS.buyer,        color: 'blue'   },
  { key: 'approver',     label: 'Approver',       user: USERS.approver,     color: 'amber'  },
  { key: 'finalApprover',label: 'Final Approver', user: USERS.finalApprover,color: 'red'    },
]

const activeColor = {
  purple: 'bg-purple-700  text-white ring-purple-600',
  blue:   'bg-blue-700    text-white ring-blue-600',
  amber:  'bg-amber-500   text-white ring-amber-400',
  red:    'bg-[#c8102e]   text-white ring-red-500',
}
const idleColor = {
  purple: 'text-purple-700  hover:bg-purple-50  ring-purple-200',
  blue:   'text-blue-700    hover:bg-blue-50    ring-blue-200',
  amber:  'text-amber-700   hover:bg-amber-50   ring-amber-200',
  red:    'text-[#c8102e]   hover:bg-red-50     ring-red-200',
}

export default function RoleSwitcher({ activeRole, onChange }) {
  const active = ROLES.find(r => r.key === activeRole)

  return (
    <div className="bg-white border-b border-gray-200 px-4 sm:px-8">
      <div className="flex items-center gap-1 overflow-x-auto py-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-3 whitespace-nowrap">
          View as:
        </span>
        {ROLES.map(r => {
          const isActive = r.key === activeRole
          return (
            <button
              key={r.key}
              onClick={() => onChange(r.key)}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition-colors whitespace-nowrap',
                isActive ? activeColor[r.color] : `bg-white ${idleColor[r.color]}`
              )}
            >
              <span className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold leading-none">
                {r.user.name.charAt(0)}
              </span>
              <span>{r.user.name}</span>
              <span className="opacity-70">— {r.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active context banner */}
      {active && (
        <div className="pb-2 text-xs text-gray-500">
          Logged in as <span className="font-medium text-gray-700">{active.user.name}</span>
          {' '}({active.user.email}) · Role: <span className="font-medium text-gray-700">{active.label}</span>
        </div>
      )}
    </div>
  )
}
