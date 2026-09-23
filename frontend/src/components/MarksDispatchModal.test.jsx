import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import MarksDispatchModal from './MarksDispatchModal'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

vi.mock('../utils/whatsapp', () => ({
  cleanPhoneNumber: (num) => String(num || '').replace(/\D/g, ''),
  openWhatsApp: vi.fn(),
  getStoredWhatsAppTarget: vi.fn().mockReturnValue('desktop'),
  setStoredWhatsAppTarget: vi.fn(),
}))

vi.mock('../api/notifications', () => ({
  markNotificationSent: vi.fn().mockResolvedValue({ id: 1, status: 'SENT' }),
}))

describe('MarksDispatchModal', () => {
  const mockDispatches = [
    {
      notification_id: 201,
      student_id: 1,
      student_name: 'Bilal Khan',
      student_code: 'STD-201',
      guardian_name: 'Tariq Khan',
      whatsapp_number: '923001112233',
      obtained_marks: 88,
      total_marks: 100,
      percentage: 88,
      grade: 'A',
      message: 'Dear Tariq Khan, Bilal Khan scored 88/100 (88%) on Physics Test 1.',
      whatsapp_web_url: 'https://web.whatsapp.com/send?phone=923001112233&text=Dear',
      whatsapp_app_url: 'whatsapp://send?phone=923001112233&text=Dear',
      status: 'PENDING',
    },
    {
      notification_id: 202,
      student_id: 2,
      student_name: 'Ayesha Malik',
      student_code: 'STD-202',
      guardian_name: 'Malik Akbar',
      whatsapp_number: '923004445566',
      obtained_marks: 45,
      total_marks: 100,
      percentage: 45,
      grade: 'D',
      message: 'Dear Malik Akbar, Ayesha Malik scored 45/100 (45%) on Physics Test 1.',
      whatsapp_web_url: 'https://web.whatsapp.com/send?phone=923004445566&text=Dear',
      whatsapp_app_url: 'whatsapp://send?phone=923004445566&text=Dear',
      status: 'PENDING',
    },
  ]

  it('renders modal with 3 Open In options (WhatsApp Web, Desktop App, wa.me Direct)', () => {
    render(
      <MarksDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        testName="Physics Test 1"
        subject="Physics"
      />
    )

    // Check header and banners
    expect(screen.getByText(/WhatsApp Marks Dispatch — Physics \(Physics Test 1\)/i)).toBeDefined()
    expect(screen.getByText('WhatsApp Marks Alert Dispatch')).toBeDefined()

    // Check all 3 Open In options from screenshot
    expect(screen.getByRole('button', { name: /WhatsApp Web/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Desktop App/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /wa.me Direct/i })).toBeDefined()

    // Check progress and action controls from screenshot
    expect(screen.getByText(/Progress:/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Send Next/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Auto-Dispatch \(10s Delay\)/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Copy All/i })).toBeDefined()

    // Check students
    expect(screen.getByText('Bilal Khan')).toBeDefined()
    expect(screen.getByText('Ayesha Malik')).toBeDefined()
    expect(screen.getByText(/88\/100 \(88%\) · Grade A/i)).toBeDefined()
    expect(screen.getByText(/45\/100 \(45%\) · Grade D/i)).toBeDefined()
  })

  it('switches to wa.me Direct and calls openWhatsApp with universal target', async () => {
    const { openWhatsApp } = await import('../utils/whatsapp')
    const { markNotificationSent } = await import('../api/notifications')

    render(
      <MarksDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        testName="Physics Test 1"
      />
    )

    // Click wa.me Direct option
    const directBtn = screen.getByRole('button', { name: /wa.me Direct/i })
    fireEvent.click(directBtn)

    // Click Send via WhatsApp on first student
    const sendButtons = screen.getAllByRole('button', { name: /Send via WhatsApp/i })
    fireEvent.click(sendButtons[0])

    expect(openWhatsApp).toHaveBeenCalledWith('923001112233', mockDispatches[0].message, 'universal')
    expect(markNotificationSent).toHaveBeenCalledWith(201)
  })

  it('switches to Desktop App and calls openWhatsApp with desktop target', async () => {
    const { openWhatsApp } = await import('../utils/whatsapp')

    render(
      <MarksDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        testName="Physics Test 1"
      />
    )

    const desktopBtn = screen.getByRole('button', { name: /Desktop App/i })
    fireEvent.click(desktopBtn)

    const sendButtons = screen.getAllByRole('button', { name: /Send via WhatsApp/i })
    fireEvent.click(sendButtons[0])

    expect(openWhatsApp).toHaveBeenCalledWith('923001112233', mockDispatches[0].message, 'desktop')
  })

  it('automatically opens first student in WhatsApp Desktop App when autoSendFirst is true', async () => {
    const { openWhatsApp } = await import('../utils/whatsapp')
    const { markNotificationSent } = await import('../api/notifications')

    render(
      <MarksDispatchModal
        open={true}
        onClose={vi.fn()}
        dispatches={mockDispatches}
        testName="Physics Test 1"
        autoSendFirst={true}
      />
    )

    // Should immediately call openWhatsApp with desktop app
    expect(openWhatsApp).toHaveBeenCalledWith('923001112233', mockDispatches[0].message, 'desktop')
    expect(markNotificationSent).toHaveBeenCalledWith(201)
  })
})
