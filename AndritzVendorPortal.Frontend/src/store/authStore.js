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

// Read persisted currentUser directly from localStorage during module load.
// Zustand persist's own rehydration runs async (via .then chains) in the
// production bundle, which loses the race against ProtectedRoute's first
// render — the store reads null and the user gets bounced to /login even
// though their session is intact. Seeding the initial value synchronously
// here makes that race unwinnable.
function readPersistedCurrentUser() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem('auth-store')
    if (!raw) return null
    return JSON.parse(raw)?.state?.currentUser ?? null
  } catch {
    return null
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser:  readPersistedCurrentUser(),
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
