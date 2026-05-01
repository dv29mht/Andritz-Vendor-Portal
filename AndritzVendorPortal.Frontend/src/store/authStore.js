import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authService } from '../features/auth/services/authService'

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

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser:  null,
      showWelcome:  false,

      get isAuthenticated() {
        return get().currentUser !== null
      },

      login: async (email, password) => {
        const data = await authService.login(email, password)
        const user = normalizeUser(data.user)
        if (data.token)     localStorage.setItem('authToken', data.token)
        if (data.csrfToken) localStorage.setItem('csrfToken', data.csrfToken)
        set({ currentUser: user, showWelcome: true })
        return user
      },

      logout: async () => {
        localStorage.removeItem('authToken')
        localStorage.removeItem('csrfToken')
        set({ currentUser: null, showWelcome: false })
        try { await authService.logout() }
        catch (err) { console.error('[authStore] logout failed:', err) }
      },

      updateUser: (partial) =>
        set((state) => ({ currentUser: { ...state.currentUser, ...partial } })),

      dismissWelcome: () => set({ showWelcome: false }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
)

export const useIsAuthenticated = () => useAuthStore((s) => s.currentUser !== null)
export const useCurrentUser     = () => useAuthStore((s) => s.currentUser)
