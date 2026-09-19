/**
 * Centralized Axios instance for all backend communication.
 * - Attaches JWT access token automatically.
 * - Transparently refreshes the access token on 401 and retries once.
 * - Normalizes error shape so UI components can render consistent messages.
 */
import axios from 'axios'

/**
 * Resolve the backend API base URL, in priority order:
 *   1. window.__ACADEXA_API_BASE_URL__ — injected by the Electron shell at
 *      runtime once the user has configured which central server this
 *      academy computer should talk to (see electron/main.js).
 *   2. VITE_API_BASE_URL — build-time env var for a plain web deployment
 *      pointing at a separately hosted API.
 *   3. '/api/v1' — relative path, used by the Vite dev/preview proxy when
 *      frontend and backend run on the same host (sandbox testing).
 */
function resolveApiBaseUrl() {
  if (typeof window !== 'undefined' && window.__ACADEXA_API_BASE_URL__) {
    return window.__ACADEXA_API_BASE_URL__
  }
  return import.meta.env.VITE_API_BASE_URL || '/api/v1'
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 20000,
})

/** Re-reads the resolved base URL (call after the Electron shell updates the server URL). */
export function refreshApiBaseUrl() {
  apiClient.defaults.baseURL = resolveApiBaseUrl()
}

function getAccessToken() {
  return localStorage.getItem('acadexa_access_token')
}

function getRefreshToken() {
  return localStorage.getItem('acadexa_refresh_token')
}

export function setTokens({ access_token, refresh_token }) {
  if (access_token) localStorage.setItem('acadexa_access_token', access_token)
  if (refresh_token) localStorage.setItem('acadexa_refresh_token', refresh_token)
}

export function clearTokens() {
  localStorage.removeItem('acadexa_access_token')
  localStorage.removeItem('acadexa_refresh_token')
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let refreshQueue = []

async function refreshAccessToken() {
  const refresh_token = getRefreshToken()
  if (!refresh_token) throw new Error('No refresh token available')
  const resp = await axios.post(`${resolveApiBaseUrl()}/auth/refresh`, { refresh_token })
  setTokens(resp.data)
  return resp.data.access_token
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    // Never try to refresh on the login/refresh endpoints themselves.
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh')

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject, originalRequest })
        })
      }

      isRefreshing = true
      try {
        const newToken = await refreshAccessToken()
        isRefreshing = false
        refreshQueue.forEach(({ resolve, originalRequest: req }) => {
          req.headers.Authorization = `Bearer ${newToken}`
          resolve(apiClient(req))
        })
        refreshQueue = []
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        isRefreshing = false
        refreshQueue.forEach(({ reject }) => reject(refreshError))
        refreshQueue = []
        clearTokens()
        window.location.hash = '#/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(normalizeError(error))
  }
)

/**
 * Triggers an authenticated file download for endpoints that require a Bearer
 * token (reports/backups/exports). A plain <a href> cannot carry the
 * Authorization header, so we fetch as a blob via the authenticated
 * apiClient instance and then trigger a browser download.
 */
export async function downloadFile(path, suggestedFilename) {
  const response = await apiClient.get(path, { responseType: 'blob' })
  const disposition = response.headers['content-disposition']
  let filename = suggestedFilename || 'download'
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/)
    if (match) filename = match[1]
  }
  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

export function normalizeError(error) {
  if (error.response?.data?.error) {
    return {
      code: error.response.data.error.code,
      message: error.response.data.error.message,
      status: error.response.status,
    }
  }
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail
    const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ') : JSON.stringify(detail))
    return {
      code: 'VALIDATION_ERROR',
      message: msg,
      status: error.response.status,
    }
  }
  if (error.message?.includes('No refresh token') || error.response?.status === 401) {
    return { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.', status: 401 }
  }
  if (error.message === 'Network Error' || !error.response) {
    return { code: 'NETWORK_ERROR', message: 'Unable to reach backend server (http://localhost:8000). Please ensure backend is running.', status: 0 }
  }
  return { code: 'UNKNOWN_ERROR', message: error.message || 'An unexpected error occurred.', status: error.response?.status }
}
