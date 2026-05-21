import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH lets the same source build for two deployment shapes:
//   - Railway / local dev: unset → base "/" (root-of-domain hosting)
//   - Office IIS sub-app:  "/SOT/" → assets emit as /SOT/assets/*, router
//                          basename and API/SignalR URLs all derive from
//                          import.meta.env.BASE_URL at runtime.
// build-publish.ps1 sets VITE_BASE_PATH for the office build.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
})
