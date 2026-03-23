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
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('authToken'))
  const [authUser, setAuthUser]   = useState(() => {
    try {
      const stored = localStorage.getItem('authUser')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const user = normalizeUser(data.user)
    localStorage.setItem('authToken', data.token)
    localStorage.setItem('authUser',  JSON.stringify(user))
    setAuthToken(data.token)
    setAuthUser(user)
    return user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('authUser')
    setAuthToken(null)
    setAuthUser(null)
  }, [])

  const updateUser = useCallback((partial) => {
    setAuthUser(prev => {
      const next = { ...prev, ...partial }
      localStorage.setItem('authUser', JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{
      currentUser:     authUser,
      isAuthenticated: !!(authToken && authUser),
      login,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
