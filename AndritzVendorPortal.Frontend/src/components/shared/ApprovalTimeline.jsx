import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid'

const iconMap = {
  Approved: <CheckCircleIcon className="h-5 w-5 text-emerald-500" />,
  Rejected: <XCircleIcon     className="h-5 w-5 text-red-500"     />,
  Pending:  <ClockIcon       className="h-5 w-5 text-gray-300"     />,
}

export default function ApprovalTimeline({ steps }) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)

  return (
    <ol className="space-y-3">
      {sorted.map((step, idx) => (
        <li key={step.id} className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">{iconMap[step.decision]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{step.approverName}</span>
              {step.isFinalApproval && (
                <span className="text-xs bg-blue-50 text-blue-700 ring-1 ring-blue-200 ring-inset px-2 py-0.5 rounded-full">
                  ⭐ Final Approver
                </span>
              )}
              <span className="text-xs text-gray-400">Step {step.stepOrder}</span>
            </div>
            {step.comment && (
              <p className="mt-0.5 text-xs text-gray-500 italic">"{step.comment}"</p>
            )}
            {step.decidedAt && (
              <p className="text-xs text-gray-400">
                {new Date(step.decidedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
            {step.decision === 'Pending' && (
              <p className="text-xs text-amber-600">Awaiting action</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
