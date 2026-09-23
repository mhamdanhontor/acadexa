import { apiClient } from './client'

export const listReports = (params) => apiClient.get('/reports', { params }).then((r) => r.data)
export const generateReports = (payload) => apiClient.post('/reports/generate', payload).then((r) => r.data)
export const approveReport = (id, approve) =>
  apiClient.post(`/reports/${id}/approve`, { approve }).then((r) => r.data)
export const sendReport = (id) => apiClient.post(`/reports/${id}/send`).then((r) => r.data)
export const approveAndSendReport = (id) => apiClient.post(`/reports/${id}/approve-and-send`).then((r) => r.data)
export const approveAndSendAllReports = (payload) => apiClient.post('/reports/approve-and-send-all', payload || {}).then((r) => r.data)
export const getMonthEndReminder = () => apiClient.get('/reports/month-end-reminder').then((r) => r.data)
export const downloadReportPath = (id) => `/reports/${id}/download`
