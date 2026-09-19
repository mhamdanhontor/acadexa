import { apiClient } from './client'

export const listNotifications = (params) => apiClient.get('/notifications', { params }).then((r) => r.data)
export const retryNotification = (id) => apiClient.post(`/notifications/${id}/retry`).then((r) => r.data)
export const markNotificationSent = (id) => apiClient.post(`/notifications/${id}/mark-sent`).then((r) => r.data)
export const dispatchPendingNotifications = () => apiClient.post('/notifications/dispatch-pending').then((r) => r.data)

export const listTemplates = () => apiClient.get('/notification-templates').then((r) => r.data)
export const updateTemplate = (id, payload) =>
  apiClient.put(`/notification-templates/${id}`, payload).then((r) => r.data)
