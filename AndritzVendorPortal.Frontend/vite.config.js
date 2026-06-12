import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH lets the same source build for two deployment shapes:
//   - Plain root hosting:  unset → base "/" (root-of-domain hosting)
//   - Office IIS sub-app / local docker stack: "/SOT/" → assets emit as
//                          /SOT/assets/*, router basename and API/SignalR URLs
//                          all derive from import.meta.env.BASE_URL at runtime.
// build-publish.ps1 (office build) and docker-compose.yml both set VITE_BASE_PATH=/SOT/.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
})
