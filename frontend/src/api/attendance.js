import { apiClient } from './client'

export const listAttendance = (params) => apiClient.get('/attendance', { params }).then((r) => r.data)
export const getAttendanceByDate = (params) => apiClient.get('/attendance/date', { params }).then((r) => r.data)
export const saveBulkAttendance = (payload) => apiClient.post('/attendance/bulk', payload).then((r) => r.data)
export const updateAttendanceRecord = (id, status) =>
  apiClient.put(`/attendance/${id}`, { status }).then((r) => r.data)
export const getAttendanceSummary = (params) => apiClient.get('/attendance/summary', { params }).then((r) => r.data)
export const getAbsentNotifications = (params) =>
  apiClient.get('/attendance/absent-notifications', { params }).then((r) => r.data)
export const getAllEnrolledAttendance = (params) => {
  const query = typeof params === 'string' ? { date: params } : (params && typeof params === 'object' ? params : {})
  return apiClient.get('/attendance/all-enrolled', { params: query }).then((r) => r.data)
}
export const saveAllEnrolledAttendance = (payload) =>
  apiClient.post('/attendance/all-enrolled', payload).then((r) => r.data)
