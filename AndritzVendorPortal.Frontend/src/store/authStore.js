import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { authService } from '../features/auth/services/authService'
import { useUIStore } from './uiStore'

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

// Decode the `exp` claim from a JWT without any extra dependency. Returns the
// expiry as a JS timestamp (ms), or null when the token is missing/unparseable.
function jwtExpiryMs(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(padded + '==='.slice((padded.length + 3) % 4))
    const exp = JSON.parse(json)?.exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

function clearPersistedAuth() {
  try {
    localStorage.removeItem('authToken')
    localStorage.removeItem('csrfToken')
    localStorage.removeItem('auth-store')
  } catch { /* ignore */ }
}

// Read persisted currentUser directly from localStorage during module load.
// Zustand persist's own rehydration runs async (via .then chains) in the
// production bundle, which loses the race against ProtectedRoute's first
// render — the store reads null and the user gets bounced to /login even
// though their session is intact. Seeding the initial value synchronously
// here makes that race unwinnable.
//
// Also validates the JWT's exp claim: if the token is already expired we
// clear the persisted user up-front so the app routes straight to /login
// instead of rendering protected pages, firing API calls, and only then
// surfacing a "Failed to load…" / session-expired banner.
function readPersistedCurrentUser() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem('auth-store')
    if (!raw) return null
    const user = JSON.parse(raw)?.state?.currentUser ?? null
    if (!user) return null

    const token = localStorage.getItem('authToken')
    const expMs = jwtExpiryMs(token)
    // Treat tokens within 5 s of expiry as already expired to avoid edge races.
    if (expMs !== null && expMs <= Date.now() + 5_000) {
      clearPersistedAuth()
      return null
    }
    return user
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
        // Hit the server while still authenticated so RevokeAllAsync actually runs —
        // clearing the token first makes POST /auth/logout go out anonymous, the
        // server skips revocation, and the old JWT stays valid until it expires.
        // Clear local state afterwards regardless of the call's outcome.
        try { await authService.logout() }
        catch (err) { console.error('[authStore] logout failed:', err) }
        finally {
          localStorage.removeItem('authToken')
          localStorage.removeItem('csrfToken')
          set({ currentUser: null, showWelcome: false })
        }
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

// Enforce one signed-in user per browser. localStorage is shared across tabs
// on the same origin, so when tab B signs in as a different user the
// auth-store key changes and tab A's "storage" event fires. If the user ID
// drifted, raise a conflict flag so the UI can block this tab until reload.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'auth-store') return
    const current = useAuthStore.getState().currentUser
    if (!current) return
    let next = null
    try {
      next = e.newValue ? JSON.parse(e.newValue)?.state?.currentUser ?? null : null
    } catch { /* corrupt JSON — treat as conflict */ }
    if (!next || next.id !== current.id) {
      useUIStore.getState().setSessionConflict(true)
    }
  })
}
