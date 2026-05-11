import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'
import { useHasHydrated } from '../store/authStore'

export default function ProtectedRoute({ children }) {
  const hasHydrated = useHasHydrated()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!hasHydrated) return null
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
