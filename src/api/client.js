import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart-library-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smart-library-token')
      localStorage.removeItem('smart-library-user')
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export function apiError(error) {
  if (error.code === 'ERR_NETWORK' || (error.request && !error.response)) {
    return `Cannot reach the Smart Library API at ${api.defaults.baseURL}. Start the backend from the backend folder with .\\run-local.ps1, then try again.`
  }
  return error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong.'
}
