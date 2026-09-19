import { apiClient } from './client'

export const listStudents = (params) => apiClient.get('/students', { params }).then((r) => r.data)
export const getStudent = (id) => apiClient.get(`/students/${id}`).then((r) => r.data)
export const createStudent = (payload) => apiClient.post('/students', payload).then((r) => r.data)
export const updateStudent = (id, payload) => apiClient.put(`/students/${id}`, payload).then((r) => r.data)
export const setStudentStatus = (id, is_active) =>
  apiClient.patch(`/students/${id}/status`, { is_active }).then((r) => r.data)
export const deleteStudent = (id) => apiClient.delete(`/students/${id}`)
