import { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

function normalizeUser(apiUser) {
  return {
    id:          apiUser.id,
    email:       apiUser.email,
    name:        apiUser.fullName,
    fullName:    apiUser.fullName,
    role:        apiUser.roles?.[0] ?? '',
    roles:       apiUser.roles ?? [],
    designation: apiUser.designation ?? '',
  }
}

export function AuthProvider({ children }) {
  // Token is now an httpOnly cookie — we only persist user profile in localStorage
  // so the app can restore the UI on refresh without a round-trip.
  const [authUser, setAuthUser] = useState(() => {
    try {
      const stored = localStorage.getItem('authUser')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [showWelcome, setShowWelcome] = useState(false)

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const user = normalizeUser(data.user)
    // Store only user profile — the JWT lives in the httpOnly auth_token cookie
    localStorage.setItem('authUser', JSON.stringify(user))
    setAuthUser(user)
    setShowWelcome(true)
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      // Ask the server to clear both cookies
      await api.post('/auth/logout')
    } catch (err) {
      // Server-side cookie deletion failed; clear client state regardless
      console.error('[AuthContext] logout API call failed:', err)
    }
    localStorage.removeItem('authUser')
    setAuthUser(null)
    setShowWelcome(false)
  }, [])

  const updateUser = useCallback((partial) => {
    setAuthUser(prev => {
      const next = { ...prev, ...partial }
      localStorage.setItem('authUser', JSON.stringify(next))
      return next
    })
  }, [])

  const dismissWelcome = useCallback(() => setShowWelcome(false), [])

  return (
    <AuthContext.Provider value={{
      currentUser:     authUser,
      // Authenticated as long as we have a user profile stored; the first API
      // call will surface a 401 (→ session-expired toast) if the cookie expired.
      isAuthenticated: authUser !== null,
      showWelcome,
      dismissWelcome,
      login,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
