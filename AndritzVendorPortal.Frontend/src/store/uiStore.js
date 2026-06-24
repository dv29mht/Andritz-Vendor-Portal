import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  sessionExpired:   false,
  sessionConflict:  false,
  // True from the moment an intentional logout begins until the next login.
  // While set, the 401 interceptor suppresses the session-expired banner so a
  // deliberate sign-out (which revokes/removes the token on purpose) can't be
  // mistaken for a session lapse by an in-flight or late request.
  loggingOut:       false,
  toast:            null,

  toggleSidebar:    () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar:       (v) => set({ sidebarCollapsed: !!v }),
  setSessionExpired:(v) => set({ sessionExpired: !!v }),
  setLoggingOut:    (v) => set({ loggingOut: !!v }),
  setSessionConflict:(v) => set({ sessionConflict: !!v }),
  showToast:        (toast) => set({ toast }),
  clearToast:       () => set({ toast: null }),
}))
