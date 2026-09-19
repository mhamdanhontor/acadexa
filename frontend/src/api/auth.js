import { apiClient, setTokens, clearTokens } from './client'

export async function login(email, password) {
  const resp = await apiClient.post('/auth/login', { email, password })
  setTokens(resp.data)
  return resp.data
}

export async function fetchMe() {
  const resp = await apiClient.get('/auth/me')
  return resp.data
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    clearTokens()
  }
}
