import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid'
import { UserMinusIcon } from '@heroicons/react/24/outline'

const iconMap = {
  Approved: <CheckCircleIcon className="h-5 w-5 text-emerald-500" />,
  Rejected: <XCircleIcon     className="h-5 w-5 text-red-500"     />,
  Pending:  <ClockIcon       className="h-5 w-5 text-gray-300"     />,
}

const deletedIcon = <CheckCircleIcon className="h-5 w-5 text-gray-300" />

export default function ApprovalTimeline({ steps, requestStatus }) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)

  return (
    <ol className="space-y-3">
      {sorted.map((step) => {
        const isDeleted = step.isDeletedApprover
        const deletedPostCompletion = isDeleted && requestStatus === 'Completed'
        const wasBlocked = !isDeleted && step.decision === 'Pending' && requestStatus === 'Completed'

        return (
          <li key={step.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {isDeleted ? deletedIcon : iconMap[step.decision]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className={`text-sm font-medium ${isDeleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {step.approverName}
                  </span>
                  {step.isFinalApproval && !isDeleted && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-[#096fb3]/10 text-[#096fb3] ring-1 ring-[#096fb3]/20 ring-inset px-2 py-0.5 rounded-full whitespace-nowrap">
                      <span>⭐</span>
                      <span>Final Approver</span>
                    </span>
                  )}
                  {isDeleted && !deletedPostCompletion && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 ring-1 ring-red-200 ring-inset px-2 py-0.5 rounded-full whitespace-nowrap">
                      <UserMinusIcon className="h-3 w-3" />
                      User deleted by Admin
                    </span>
                  )}
                  {deletedPostCompletion && (
                    <span className="text-xs text-gray-400">User was deleted by Admin</span>
                  )}
                  {wasBlocked && (
                    <span className="text-xs text-gray-400">User was blocked from acting</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">Step {step.stepOrder}</span>
              </div>
              {!isDeleted && !wasBlocked && step.comment && (
                <p className="mt-0.5 text-xs text-gray-500 italic">"{step.comment}"</p>
              )}
              {!isDeleted && !wasBlocked && step.decidedAt && (
                <p className="text-xs text-gray-400">
                  {new Date(step.decidedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
              {!isDeleted && !wasBlocked && step.decision === 'Pending' && (
                <p className="text-xs text-amber-600">Awaiting action</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
