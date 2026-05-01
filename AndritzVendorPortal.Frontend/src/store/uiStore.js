import { create } from 'zustand'

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  sessionExpired:   false,
  toast:            null,

  toggleSidebar:    () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar:       (v) => set({ sidebarCollapsed: !!v }),
  setSessionExpired:(v) => set({ sessionExpired: !!v }),
  showToast:        (toast) => set({ toast }),
  clearToast:       () => set({ toast: null }),
}))
