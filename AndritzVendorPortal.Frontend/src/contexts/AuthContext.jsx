import { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

function normalizeUser(apiUser) {
  return {
    id:       apiUser.id,
    email:    apiUser.email,
    name:     apiUser.fullName,
    fullName: apiUser.fullName,
    role:     apiUser.roles?.[0] ?? '',
    roles:    apiUser.roles ?? [],
  }
}

export function AuthProvider({ children }) {
  const [authToken,    setAuthToken]    = useState(() => localStorage.getItem('authToken'))
  const [authUser,     setAuthUser]     = useState(() => {
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
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('authUser',  JSON.stringify(user))
    // All three in the same microtask → React 18 batches into one re-render,
    // so isAuthenticated and showWelcome become true simultaneously (no flash).
    setAuthToken(data.token)
    setAuthUser(user)
    setShowWelcome(true)
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    setAuthToken(null)
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
      isAuthenticated: !!(authToken && authUser),
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
