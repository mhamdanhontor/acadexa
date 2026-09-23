import { apiClient } from './client'

// Test Sessions
export const listTestSessions = () => apiClient.get('/test-sessions').then((r) => r.data)
export const createTestSession = (payload) => apiClient.post('/test-sessions', payload).then((r) => r.data)
export const deleteTestSession = (id) => apiClient.delete(`/test-sessions/${id}`)

// Tests
export const listTests = (params) => apiClient.get('/tests', { params }).then((r) => r.data)
export const createTest = (payload) => apiClient.post('/tests', payload).then((r) => r.data)
export const getTest = (id) => apiClient.get(`/tests/${id}`).then((r) => r.data)
export const deleteTest = (id) => apiClient.delete(`/tests/${id}`)

// Marks
export const listMarks = (params) => apiClient.get('/marks', { params }).then((r) => r.data)
export const saveBulkMarks = (payload) => apiClient.post('/marks/bulk', payload).then((r) => r.data)
export const saveQuickMarks = (payload) => apiClient.post('/marks/quick', payload).then((r) => r.data)
export const updateMarks = (id, obtained_marks) =>
  apiClient.put(`/marks/${id}`, null, { params: { obtained_marks } }).then((r) => r.data)
export const getMarksNotifications = (params) =>
  apiClient.get('/marks/notifications', { params }).then((r) => r.data)
