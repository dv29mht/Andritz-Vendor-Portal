import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import { ROLES } from '../shared/constants/roles'
import BuyerConsole         from '../features/consoles/components/BuyerConsole'
import ApproverConsole      from '../features/consoles/components/ApproverConsole'
import FinalApproverConsole from '../features/consoles/components/FinalApproverConsole'
import AdminConsole         from '../features/consoles/components/AdminConsole'

const CONSOLE_BY_ROLE = {
  [ROLES.Buyer]:    BuyerConsole,
  [ROLES.Approver]: ApproverConsole,
}

// The single elevated account (Final Approver — which now also holds every former
// admin capability) gets a merged experience: admin-owned pages render the
// AdminConsole, final-approval pages render the FinalApproverConsole. Each console
// already switches on `activePage`, so we just dispatch per page — no rewrite. The
// merged sidebar (see AppShell NAV) is the union of both page sets.
const ELEVATED_CONSOLE_BY_PAGE = {
  dashboard: AdminConsole,         // global stats overview
  requests:  AdminConsole,         // All Requests
  vendors:   AdminConsole,         // Permanent Vendors with admin edit/archive
  users:     AdminConsole,         // User Management
  pending:   FinalApproverConsole, // Final-review queue
  history:   FinalApproverConsole, // own final-approval decisions
}

export default function ConsoleRoute() {
  const { workflow, currentUser } = useOutletContext()
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard'

  const Console = currentUser.role === ROLES.FinalApprover
    ? (ELEVATED_CONSOLE_BY_PAGE[activePage] ?? AdminConsole)
    : CONSOLE_BY_ROLE[currentUser.role]
  if (!Console) return null

  return (
    <Console
      workflow={workflow}
      currentUser={currentUser}
      activePage={activePage}
      onNavigate={(id) => navigate(`/${id}`)}
    />
  )
}
