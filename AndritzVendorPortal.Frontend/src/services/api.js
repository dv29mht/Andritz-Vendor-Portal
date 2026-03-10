import axios from 'axios'

const api = axios.create({
  // This will use the Vercel setting if it exists, 
  // otherwise it falls back to your local server
  baseURL: import.meta.env.VITE_API_URL ?? 'https://andritz-vendor-portal.onrender.com/api',
})

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear stored credentials and redirect to login
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('authUser')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export default api
