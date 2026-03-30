import axios from 'axios'

const renderUrl = 'https://andritz-vendor-portal.onrender.com/api'

// In production (Vercel), use a relative base URL so every request goes to
// /api/... on the same origin. Vercel's proxy rewrite (vercel.json) forwards
// these to the Render backend transparently. This means the auth_token cookie
// is set on the Vercel domain — same-origin — so browser cross-site cookie
// restrictions (Privacy Sandbox, incognito) can never block it.
//
// In dev, fall back to the Render URL directly (or VITE_API_URL for local backend).
const baseURL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? renderUrl : '/api')

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[api] VITE_API_URL is not set — dev requests will go to the PRODUCTION backend (%s). ' +
    'Set VITE_API_URL in .env.local to point at your local server.',
    renderUrl
  )
}

const api = axios.create({
  baseURL,
  withCredentials: true,
})

// Read the CSRF token that was stored in localStorage at login time.
// The server returns it in the login response body because the frontend and backend
// are on different domains — document.cookie can only read cookies for the current
// domain, so the csrf_token cookie (set on the Render domain) is not readable here.
// An attacker on another origin cannot read localStorage, so this is safe.
function getCsrfToken() {
  return localStorage.getItem('csrfToken') ?? ''
}

api.interceptors.request.use(config => {
  const csrf = getCsrfToken()
  if (csrf) config.headers['X-CSRF-Token'] = csrf
  return config
})

// On 401, fire a custom event so the UI can show a graceful session-expired
// warning rather than silently wiping state and hard-redirecting.
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      window.dispatchEvent(new Event('session-expired'))
    }
    return Promise.reject(error)
  }
)

export default api
