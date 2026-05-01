import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import AppShell from '../shared/components/AppShell'
import { useAuth } from '../features/auth/hooks/useAuth'
import { useVendorWorkflow } from '../features/vendors/hooks/useVendorWorkflow'

export default function AppLayout() {
  const { currentUser, logout } = useAuth()
  const workflow                = useVendorWorkflow()
  const location                = useLocation()
  const navigate                = useNavigate()

  // Derive activePage from the URL — first path segment ("/dashboard" → "dashboard").
  const activePage = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard'

  return (
    <AppShell
      workflow={workflow}
      currentUser={currentUser}
      onLogout={() => { logout(); navigate('/login') }}
      activePage={activePage}
      setActivePage={(id) => navigate(`/${id}`)}
    >
      <Outlet context={{ workflow, currentUser }} />
    </AppShell>
  )
}
