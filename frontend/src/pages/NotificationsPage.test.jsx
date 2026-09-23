import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'
import * as notificationsApi from '../api/notifications'
import * as whatsappUtils from '../utils/whatsapp'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Admin', role_name: 'SUPER_ADMIN' },
    hasRole: () => true,
  }),
}))

vi.mock('../api/notifications', () => ({
  listNotifications: vi.fn(),
  listTemplates: vi.fn(),
  retryNotification: vi.fn(),
  markNotificationSent: vi.fn(),
  dispatchPendingNotifications: vi.fn(),
  deletePendingNotifications: vi.fn(),
  deleteAllNotifications: vi.fn(),
  deleteNotification: vi.fn(),
  updateTemplate: vi.fn(),
}))

vi.mock('../utils/whatsapp', () => ({
  openWhatsApp: vi.fn(),
  getStoredWhatsAppTarget: vi.fn(() => 'desktop'),
}))

describe('NotificationsPage — Delete Actions and WhatsApp Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Delete Pending and Clear All History buttons for Admin', async () => {
    notificationsApi.listNotifications.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          student_id: 10,
          type: 'ABSENCE',
          recipient: '923001234567',
          message: '*ABSENCE NOTICE*\n*غیر حاضری کی اطلاع*',
          status: 'SENT',
          retry_count: 0,
        },
      ],
      total: 1,
      total_pages: 1,
    })

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Delete Pending')).toBeDefined()
      expect(screen.getByText('Clear All History')).toBeDefined()
      expect(screen.getByText('Dispatch All Pending')).toBeDefined()
    })
  })

  it('prompts to clear history when clicking Delete Pending with 0 pending jobs', async () => {
    notificationsApi.listNotifications.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          student_id: 10,
          type: 'ABSENCE',
          recipient: '923001234567',
          message: 'Test message',
          status: 'SENT',
          retry_count: 0,
        },
      ],
      total: 1,
      total_pages: 1,
    })

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Delete Pending')).toBeDefined())

    fireEvent.click(screen.getByText('Delete Pending'))

    await waitFor(() => {
      expect(screen.getByText('No Pending Notifications')).toBeDefined()
      expect(screen.getAllByText('Clear All History').length).toBe(2)
    })
  })

  it('clears all notifications when confirming Clear All History', async () => {
    notificationsApi.listNotifications.mockResolvedValueOnce({
      items: [
        {
          id: 1,
          student_id: 10,
          type: 'ABSENCE',
          recipient: '923001234567',
          message: 'Test message',
          status: 'SENT',
          retry_count: 0,
        },
      ],
      total: 1,
      total_pages: 1,
    })
    notificationsApi.deleteAllNotifications.mockResolvedValueOnce({ deleted: 1 })
    notificationsApi.listNotifications.mockResolvedValueOnce({ items: [], total: 0, total_pages: 1 })

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText('Clear All History')).toBeDefined())

    fireEvent.click(screen.getByText('Clear All History'))

    await waitFor(() => {
      expect(screen.getByText('Clear All Notifications History')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Clear All Notifications'))

    await waitFor(() => {
      expect(notificationsApi.deleteAllNotifications).toHaveBeenCalledWith('ALL')
    })
  })
})
