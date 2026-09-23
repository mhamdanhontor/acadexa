import { apiClient } from './client'

// Classes
export const listClasses = (params) => apiClient.get('/classes', { params }).then((r) => r.data)
export const createClass = (payload) => apiClient.post('/classes', payload).then((r) => r.data)
export const updateClass = (id, payload) => apiClient.put(`/classes/${id}`, payload).then((r) => r.data)
export const setClassStatus = (id, is_active) =>
  apiClient.patch(`/classes/${id}/status`, { is_active }).then((r) => r.data)
export const deleteClass = (id) => apiClient.delete(`/classes/${id}`)

// Batches
export const listBatches = (params) => apiClient.get('/batches', { params }).then((r) => r.data)
export const createBatch = (payload) => apiClient.post('/batches', payload).then((r) => r.data)
export const updateBatch = (id, payload) => apiClient.put(`/batches/${id}`, payload).then((r) => r.data)
export const setBatchStatus = (id, is_active) =>
  apiClient.patch(`/batches/${id}/status`, { is_active }).then((r) => r.data)
export const deleteBatch = (id) => apiClient.delete(`/batches/${id}`)

// Subjects
export const listSubjects = (params) => apiClient.get('/subjects', { params }).then((r) => r.data)
export const createSubject = (payload) => apiClient.post('/subjects', payload).then((r) => r.data)
export const setSubjectStatus = (id, is_active) =>
  apiClient.patch(`/subjects/${id}/status`, { is_active }).then((r) => r.data)
export const deleteSubject = (id) => apiClient.delete(`/subjects/${id}`)
