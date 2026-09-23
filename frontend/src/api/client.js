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
  timeout: 60000,
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
  if (!error) {
    return { _isNormalized: true, code: 'UNKNOWN_ERROR', message: 'An unknown error occurred.', status: 0 }
  }

  // 1. If error is already normalized, return it immediately (idempotent)
  if (error._isNormalized || (error.code && error.message && typeof error.status !== 'undefined' && !error.isAxiosError)) {
    return {
      _isNormalized: true,
      code: error.code,
      message: error.message,
      status: error.status,
    }
  }

  // 2. Structured error from our FastAPI backend: { error: { code, message } }
  if (error.response?.data?.error) {
    const code = error.response.data.error.code || 'APP_ERROR'
    let message = error.response.data.error.message || 'Request failed.'

    // Friendly message for invalid login credentials
    if (code === 'AUTHENTICATION_ERROR' || error.response.status === 401) {
      if (
        message.toLowerCase().includes('invalid email or password') ||
        message.toLowerCase().includes('authentication failed') ||
        message.toLowerCase().includes('invalid credentials')
      ) {
        message = 'Incorrect email/username or password. Please check your credentials.'
      }
    }

    return {
      _isNormalized: true,
      code,
      message,
      status: error.response.status,
    }
  }

  // 3. Pydantic / FastAPI validation error: { detail: ... }
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
          : JSON.stringify(detail)
    return {
      _isNormalized: true,
      code: 'VALIDATION_ERROR',
      message: msg,
      status: error.response.status,
    }
  }

  // 4. Server internal error (HTTP 500, 502, 503, 504)
  const status = error.response?.status
  if (status && status >= 500) {
    const serverMessage =
      error.response?.data?.message || (typeof error.response?.data === 'string' ? error.response.data : null)
    return {
      _isNormalized: true,
      code: 'SERVER_ERROR',
      message:
        serverMessage ||
        `Server error (${status}). The server encountered an internal issue. Please try again later or contact administrator.`,
      status,
    }
  }

  // 5. 401 Unauthorized (session expired vs login failure)
  if (status === 401 || error.message?.includes('No refresh token')) {
    const isLoginEndpoint = error.config?.url?.includes('/auth/login')
    return {
      _isNormalized: true,
      code: 'AUTHENTICATION_ERROR',
      message: isLoginEndpoint
        ? 'Incorrect email/username or password. Please check your credentials.'
        : 'Session expired. Please log in again.',
      status: 401,
    }
  }

  // 6. 403 Forbidden
  if (status === 403) {
    return {
      _isNormalized: true,
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.',
      status: 403,
    }
  }

  // 7. 404 Not Found
  if (status === 404) {
    return {
      _isNormalized: true,
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      status: 404,
    }
  }

  // 8. Connection timeout
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    const target = resolveApiBaseUrl()
    return {
      _isNormalized: true,
      code: 'TIMEOUT',
      message: `Connection timed out (${target}). If the backend is hosted on a free cloud service, it may take up to a minute to wake up from sleep. Please try again.`,
      status: 0,
    }
  }

  // 9. True Network Error (backend offline, DNS resolution failure, connection refused)
  if ((error.isAxiosError && !error.response) || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    const target = resolveApiBaseUrl()
    return {
      _isNormalized: true,
      code: 'NETWORK_ERROR',
      message: `Unable to reach backend server (${target}). Please ensure the backend is running and your internet connection is active.`,
      status: 0,
    }
  }

  // 10. Fallback for any other error
  return {
    _isNormalized: true,
    code: 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred.',
    status: status || 0,
  }
}
