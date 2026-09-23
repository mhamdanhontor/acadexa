import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import React from 'react'
import AttendanceDispatchModal from './AttendanceDispatchModal'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

vi.mock('../utils/whatsapp', () => ({
  cleanPhoneNumber: (num) => num.replace(/\D/g, ''),
  openWhatsApp: vi.fn(),
  getStoredWhatsAppTarget: vi.fn().mockReturnValue('desktop'),
  setStoredWhatsAppTarget: vi.fn(),
}))

vi.mock('../api/notifications', () => ({
  markNotificationSent: vi.fn().mockResolvedValue({ id: 1, status: 'SENT' }),
}))

describe('AttendanceDispatchModal', () => {
  const mockDispatches = [
    {
      notification_id: 101,
      student_id: 1,
      student_name: 'Zain Ali',
      student_code: 'STD-101',
      guardian_name: 'Ali Raza',
      whatsapp_number: '923001234567',
      status_type: 'ABSENT',
      message: 'Dear Ali Raza, Zain Ali was ABSENT today.',
      whatsapp_web_url: 'https://web.whatsapp.com/send?phone=923001234567&text=Dear',
      whatsapp_app_url: 'whatsapp://send?phone=923001234567&text=Dear',
      status: 'PENDING',
    },
    {
      notification_id: 102,
      student_id: 2,
      student_name: 'Fatima Noor',
      student_code: 'STD-102',
      guardian_name: 'Noor Din',
      whatsapp_number: '923007654321',
      status_type: 'LEAVE',
      message: 'Dear Noor Din, Fatima Noor was marked on LEAVE today.',
      whatsapp_web_url: 'https://web.whatsapp.com/send?phone=923007654321&text=Dear',
      whatsapp_app_url: 'whatsapp://send?phone=923007654321&text=Dear',
      status: 'PENDING',
    },
  ]

  it('renders modal with absent and leave students and controls', () => {
    render(
      <AttendanceDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        sessionDate="2026-09-19"
      />
    )

    expect(screen.getByText('WhatsApp Attendance Dispatch (Absent & Leave)')).toBeDefined()
    expect(screen.getByText('Zain Ali')).toBeDefined()
    expect(screen.getByText('Fatima Noor')).toBeDefined()
    expect(screen.getByText('ABSENT')).toBeDefined()
    expect(screen.getByText('LEAVE')).toBeDefined()
    expect(screen.getByText('Auto-Dispatch (10s Delay)')).toBeDefined()
  })

  it('marks a single message as sent when Send button is clicked', async () => {
    const { openWhatsApp } = await import('../utils/whatsapp')
    const { markNotificationSent } = await import('../api/notifications')

    render(
      <AttendanceDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        sessionDate="2026-09-19"
      />
    )

    const sendButtons = screen.getAllByRole('button', { name: /Send via WhatsApp/i })
    fireEvent.click(sendButtons[0])

    expect(openWhatsApp).toHaveBeenCalledWith('923001234567', mockDispatches[0].message, 'desktop')
    expect(markNotificationSent).toHaveBeenCalledWith(101)
  })

  it('supports absentees prop as an alias for dispatches', () => {
    render(
      <AttendanceDispatchModal
        open={true}
        onClose={vi.fn()}
        absentees={mockDispatches}
        sessionDate="2026-09-19"
      />
    )

    expect(screen.getByText('Zain Ali')).toBeDefined()
    expect(screen.getByText('Fatima Noor')).toBeDefined()
  })

  it('automatically triggers first student when autoSendFirst is true', async () => {
    const { openWhatsApp } = await import('../utils/whatsapp')
    const { markNotificationSent } = await import('../api/notifications')

    render(
      <AttendanceDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        sessionDate="2026-09-19"
        autoSendFirst={true}
      />
    )

    expect(openWhatsApp).toHaveBeenCalledWith('923001234567', mockDispatches[0].message, 'desktop')
    expect(markNotificationSent).toHaveBeenCalledWith(101)
  })

  it('handles auto-dispatch with 10s delay countdown pacing between messages', async () => {
    vi.useFakeTimers()
    const { openWhatsApp } = await import('../utils/whatsapp')

    render(
      <AttendanceDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        sessionDate="2026-09-19"
      />
    )

    // Click Auto-Dispatch (10s Delay) button
    const autoBtn = screen.getByRole('button', { name: /Auto-Dispatch \(10s Delay\)/i })
    fireEvent.click(autoBtn)

    // First student sent immediately
    expect(openWhatsApp).toHaveBeenCalledTimes(1)
    expect(openWhatsApp).toHaveBeenCalledWith('923001234567', mockDispatches[0].message, 'desktop')

    // Advance by 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    // Second student sent after 10s delay
    expect(openWhatsApp).toHaveBeenCalledTimes(2)
    expect(openWhatsApp).toHaveBeenCalledWith('923007654321', mockDispatches[1].message, 'desktop')

    vi.useRealTimers()
  })
})
