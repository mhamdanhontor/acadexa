/**
 * Centralized Axios instance for all backend communication.
 * - Attaches JWT access token automatically.
 * - Transparently refreshes the access token on 401 and retries once.
 * - Normalizes error shape so UI components can render consistent messages.
 */
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
})

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
  const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token })
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
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(normalizeError(error))
  }
)

export function normalizeError(error) {
  if (error.response?.data?.error) {
    return {
      code: error.response.data.error.code,
      message: error.response.data.error.message,
      status: error.response.status,
    }
  }
  if (error.message === 'Network Error' || !error.response) {
    return { code: 'NETWORK_ERROR', message: 'Unable to reach the server. Please check your internet connection.', status: 0 }
  }
  return { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.', status: error.response?.status }
}
