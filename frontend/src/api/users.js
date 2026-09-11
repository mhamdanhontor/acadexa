import { apiClient } from './client'

export const listUsers = (params) => apiClient.get('/users', { params }).then((r) => r.data)
export const listRoles = () => apiClient.get('/users/roles').then((r) => r.data)
export const createUser = (payload) => apiClient.post('/users', payload).then((r) => r.data)
export const updateUser = (id, payload) => apiClient.put(`/users/${id}`, payload).then((r) => r.data)
export const setUserStatus = (id, is_active) =>
  apiClient.patch(`/users/${id}/status`, { is_active }).then((r) => r.data)
