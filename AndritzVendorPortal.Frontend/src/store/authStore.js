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
      hasHydrated:  false,

      get isAuthenticated() {
        return get().currentUser !== null
      },

      setHasHydrated: (v) => set({ hasHydrated: !!v }),

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

// Mark the store as hydrated once persist signals it's done. Using the
// onFinishHydration API (rather than onRehydrateStorage inside the config)
// because it fires reliably for both sync and async storage paths in
// Zustand v5, and we can also handle the already-hydrated case directly.
useAuthStore.persist.onFinishHydration(() => {
  useAuthStore.setState({ hasHydrated: true })
})
if (useAuthStore.persist.hasHydrated()) {
  useAuthStore.setState({ hasHydrated: true })
}

export const useHasHydrated = () => useAuthStore((s) => s.hasHydrated)

export const useIsAuthenticated = () => useAuthStore((s) => s.currentUser !== null)
export const useCurrentUser     = () => useAuthStore((s) => s.currentUser)
