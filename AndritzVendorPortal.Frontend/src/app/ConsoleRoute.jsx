import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import { ROLES } from '../shared/constants/roles'
import BuyerConsole         from '../features/consoles/components/BuyerConsole'
import ApproverConsole      from '../features/consoles/components/ApproverConsole'
import FinalApproverConsole from '../features/consoles/components/FinalApproverConsole'
import AdminConsole         from '../features/consoles/components/AdminConsole'

const CONSOLE_BY_ROLE = {
  [ROLES.Buyer]:         BuyerConsole,
  [ROLES.Approver]:      ApproverConsole,
  [ROLES.FinalApprover]: FinalApproverConsole,
  [ROLES.Admin]:         AdminConsole,
}

export default function ConsoleRoute() {
  const { workflow, currentUser } = useOutletContext()
  const navigate = useNavigate()
  const location = useLocation()
  const activePage = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard'

  const Console = CONSOLE_BY_ROLE[currentUser.role]
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
