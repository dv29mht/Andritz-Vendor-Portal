import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'

export default function RoleRoute({ allow, children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (allow && !allow.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
