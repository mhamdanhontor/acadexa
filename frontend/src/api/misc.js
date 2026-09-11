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
export const downloadBackupPath = (id) => `/backups/${id}/download`

// Settings
export const fetchSettings = () => apiClient.get('/settings').then((r) => r.data)
export const updateSettings = (payload) => apiClient.put('/settings', payload).then((r) => r.data)

// Exports (paths for use with downloadFile() — require auth, cannot use plain <a href>)
export const exportStudentsPath = () => '/exports/students'
export const exportAttendancePath = () => '/exports/attendance'
export const exportMarksPath = () => '/exports/marks'
