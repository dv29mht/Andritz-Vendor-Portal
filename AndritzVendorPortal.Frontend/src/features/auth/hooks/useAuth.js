import { useAuthStore } from '../../../store/authStore'

export function useAuth() {
  const currentUser    = useAuthStore((s) => s.currentUser)
  const showWelcome    = useAuthStore((s) => s.showWelcome)
  const login          = useAuthStore((s) => s.login)
  const logout         = useAuthStore((s) => s.logout)
  const updateUser     = useAuthStore((s) => s.updateUser)
  const dismissWelcome = useAuthStore((s) => s.dismissWelcome)

  return {
    currentUser,
    isAuthenticated: currentUser !== null,
    showWelcome,
    login,
    logout,
    updateUser,
    dismissWelcome,
  }
}
