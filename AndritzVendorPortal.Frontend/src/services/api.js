import axios from 'axios'

const renderUrl = 'https://andritz-vendor-portal.onrender.com/api'

// In production (Vercel), use a relative base URL so every request goes to
// /api/... on the same origin. Vercel's proxy rewrite (vercel.json) forwards
// these to the Render backend transparently. This means the auth_token cookie
// is set on the Vercel domain — same-origin — so browser cross-site cookie
// restrictions (Privacy Sandbox, incognito) can never block it.
//
// In dev, fall back to the Render URL directly (or VITE_API_URL for local backend).
// Production builds ALWAYS use the Vercel proxy (/api → Render via vercel.json rewrite).
// VITE_API_URL is only honoured in dev so local development can target a local backend.
const baseURL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? renderUrl)
  : '/api'

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

// Read the JWT token stored in localStorage at login time.
// Vercel proxy rewrites forward request headers (including Authorization) to the
// backend, but do not reliably forward httpOnly Set-Cookie response headers back to
// the browser — so we cannot rely on the auth_token cookie being set. Sending the
// JWT as a Bearer token in the Authorization header works through the proxy.
function getToken() {
  return localStorage.getItem('authToken') ?? ''
}

// Read the CSRF token that was stored in localStorage at login time.
function getCsrfToken() {
  return localStorage.getItem('csrfToken') ?? ''
}

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
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
