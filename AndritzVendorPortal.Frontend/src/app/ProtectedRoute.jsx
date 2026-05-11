import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/hooks/useAuth'

export default function ProtectedRoute({ children }) {
  // Defer the auth check until after the first commit so Zustand's persist
  // middleware has had a microtask to rehydrate currentUser from localStorage.
  // Without this, the very first render sees currentUser=null and Navigate
  // sticks us at /login even if a valid session existed.
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(true) }, [])

  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!ready) return null
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
