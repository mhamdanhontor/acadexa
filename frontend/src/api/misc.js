import { apiClient } from './client'

// Dashboard
export const fetchDashboardSummary = () => apiClient.get('/dashboard/summary').then((r) => r.data)

// Audit logs
export const listAuditLogs = (params) => apiClient.get('/audit-logs', { params }).then((r) => r.data)

// Backups
export const listBackups = () => apiClient.get('/backups').then((r) => r.data)
export const createBackup = () => apiClient.post('/backups').then((r) => r.data)
export const restoreBackup = (backup_id, confirm) =>
  apiClient.post('/backups/restore', { backup_id, confirm }).then((r) => r.data)
export const downloadBackupUrl = (id) => `${apiClient.defaults.baseURL}/backups/${id}/download`

// Settings
export const fetchSettings = () => apiClient.get('/settings').then((r) => r.data)
export const updateSettings = (payload) => apiClient.put('/settings', payload).then((r) => r.data)

// Exports
export const exportStudentsUrl = () => `${apiClient.defaults.baseURL}/exports/students`
export const exportAttendanceUrl = () => `${apiClient.defaults.baseURL}/exports/attendance`
export const exportMarksUrl = () => `${apiClient.defaults.baseURL}/exports/marks`
