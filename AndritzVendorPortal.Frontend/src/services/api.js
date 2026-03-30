import axios from 'axios'

const prodUrl = 'https://andritz-vendor-portal.onrender.com/api'

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn(
    '[api] VITE_API_URL is not set — requests will go to the PRODUCTION backend (%s). ' +
    'Set VITE_API_URL in .env.local to point at your local server.',
    prodUrl
  )
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? prodUrl,
  // Required so the browser sends and receives httpOnly auth cookies cross-origin
  withCredentials: true,
})

// Read the non-httpOnly csrf_token cookie and attach it as a header on every
// state-changing request. The backend CSRF middleware compares header to cookie —
// an attacker on another origin cannot read the cookie so cannot forge the header.
function getCsrfToken() {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrf_token='))
    ?.split('=')[1] ?? ''
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
