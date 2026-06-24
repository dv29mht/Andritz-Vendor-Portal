import axios from 'axios'
import { useUIStore } from '../store/uiStore'

// Fallback for a dev server (`npm run dev`) when VITE_API_URL isn't set:
// the dockerized API from docker-compose.yml, served under /SOT.
const devFallbackApiUrl = 'http://localhost:8080/SOT/api'

// In production, use a same-origin base URL so every request goes to
// {BASE_URL}api/... on the same origin. BASE_URL is "/SOT/" for the office IIS
// sub-app build / local docker stack (set by vite.config.js `base`).
// Same-origin means the auth cookie + JWT both stay first-party.
//
// In dev, fall back to the dockerized local API (or VITE_API_URL for a custom
// backend). VITE_API_URL is only honoured in dev so local development can
// target a local server.
const baseURL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL ?? devFallbackApiUrl)
  : `${import.meta.env.BASE_URL}api`

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[api] VITE_API_URL is not set — dev requests will go to the local docker API (%s). ' +
    'Set VITE_API_URL in .env.local to point at a different server.',
    devFallbackApiUrl
  )
}

const api = axios.create({
  baseURL,
  withCredentials: true,
})

// Read the JWT token stored in localStorage at login time.
// A reverse proxy may forward request headers (including Authorization) to the
// backend but not reliably forward httpOnly Set-Cookie response headers back to
// the browser — so we cannot rely on the auth_token cookie being set. Sending the
// JWT as a Bearer token in the Authorization header works through any proxy.
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

// Backend wraps every response in a Result<T> envelope:
//   { success, message, errors, data }
// Unwrap it here so call sites can treat response.data as the payload directly.
function isEnvelope(body) {
  return body && typeof body === 'object'
    && typeof body.success === 'boolean'
    && Object.prototype.hasOwnProperty.call(body, 'data')
}

api.interceptors.response.use(
  response => {
    if (isEnvelope(response.data)) {
      response.data = response.data.data
    }
    return response
  },
  error => {
    // On 401, flag the UI store so the app shows a graceful session-expired
    // banner rather than silently wiping state and hard-redirecting.
    //
    // Two cases must NOT raise the banner:
    //  - the auth endpoints themselves (login/logout) — a 401 there is the
    //    request's own concern, not a lapsed session.
    //  - while an intentional logout is in flight — sign-out revokes the token
    //    server-side (RevokeAllAsync) and removes it locally on purpose, so any
    //    in-flight poll / late request that 401s mid-logout would otherwise
    //    resurrect the banner just as the user is leaving.
    const url = error.config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/logout')
    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !useUIStore.getState().loggingOut
    ) {
      useUIStore.getState().setSessionExpired(true)
    }
    // Surface the envelope's error message at err.response.data.message
    // so existing `err?.response?.data?.message` reads keep working.
    return Promise.reject(error)
  }
)

export default api
