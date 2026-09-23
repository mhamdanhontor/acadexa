import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StudentDetailModal from './StudentDetailModal'

vi.mock('../utils/whatsapp', () => ({
  openWhatsApp: vi.fn(),
  cleanPhoneNumber: (phone) => phone?.replace(/\D/g, '') || '',
  getStoredWhatsAppTarget: vi.fn().mockReturnValue('desktop'),
  setStoredWhatsAppTarget: vi.fn(),
}))

vi.mock('../utils/feeVoucherPdf', () => ({
  getFormattedDueDate: (feeMonth) => `10th of ${feeMonth || 'each month'}`,
  buildFeeVoucherPdf: vi.fn(),
  downloadFeeVoucherPdf: vi.fn().mockReturnValue('Fee_Receipt_HONOR_Test_Student_September_2026.pdf'),
  printFeeVoucherPdf: vi.fn(),
}))

vi.mock('../api/attendance', () => ({
  listAttendance: vi.fn().mockResolvedValue([
    { id: 1, date: '2026-09-20', status: 'PRESENT', created_at: '2026-09-20T10:00:00Z' },
    { id: 2, date: '2026-09-21', status: 'LATE', created_at: '2026-09-21T10:00:00Z' },
    { id: 3, date: '2026-09-22', status: 'PRESENT', created_at: '2026-09-22T10:00:00Z' },
    { id: 4, date: '2026-09-23', status: 'PRESENT', created_at: '2026-09-23T10:00:00Z' },
  ]),
  getAttendanceSummary: vi.fn().mockResolvedValue({
    total_classes: 4,
    present: 3,
    absent: 0,
    late: 1,
    leave: 0,
    percentage: 100.0,
  }),
}))

vi.mock('../api/academics', () => ({
  listMarks: vi.fn().mockResolvedValue([]),
}))

describe('StudentDetailModal — Attendance & Simplified Fee Voucher', () => {
  const mockStudent = {
    id: 1,
    student_code: 'HKA-101',
    name: 'Hamdan Khan',
    name_ur: 'حمدان خان',
    guardian_name: 'Zahid Khan',
    guardian_name_ur: 'زاہد خان',
    whatsapp_number: '923001234567',
    is_active: true,
    class_room: { name: 'Class 10' },
    batch: { name: 'Morning Batch' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders attendance KPI statistics cards accurately on student profile', async () => {
    render(<StudentDetailModal open={true} onClose={() => {}} student={mockStudent} />)

    // Wait for student history loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /Loading/i })).toBeNull()
    })

    // Verify KPI cards have numbers
    expect(screen.getByText('Total Days')).toBeDefined()
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('Present')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    expect(screen.getByText('Absent')).toBeDefined()
    expect(screen.getByText('0')).toBeDefined()
    expect(screen.getByText('Late')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('renders simplified Fees tab without fines, with previous fee records and circular PAID stamp', async () => {
    render(<StudentDetailModal open={true} onClose={() => {}} student={mockStudent} />)

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /Loading/i })).toBeNull()
    })

    // Switch to Fees tab
    const feeTabButton = screen.getByRole('button', { name: /Fee Receipts & Invoices/i })
    fireEvent.click(feeTabButton)

    // 1. Check Honor Knowledge Academy header & title
    expect(screen.getAllByText(/Honor Knowledge Academy/i).length).toBeGreaterThan(0)

    // 2. Fine fields and red warnings should NOT be present
    expect(screen.queryByText(/Late Fee \/ Fine \(PKR\)/i)).toBeNull()
    expect(screen.queryByText(/RED IN VOUCHER/i)).toBeNull()
    expect(screen.queryByText(/APPLIED IN RED/i)).toBeNull()

    // 3. Clean fee input should exist
    expect(screen.getByText(/Fee Amount Received \(PKR\)/i)).toBeDefined()

    // 4. Check Previous Fee Records section
    expect(screen.getByText(/Previous Fee Payment Records/i)).toBeDefined()

    // 5. Check "Honor Knowledge Academy" PAID Rubber Stamp
    expect(screen.getByText('★ PAID ★')).toBeDefined()
    expect(screen.getByText(/Official Academy Paid Stamp/i)).toBeDefined()

    // 6. Check WhatsApp Desktop target button
    expect(screen.getByRole('button', { name: /^WhatsApp Desktop/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Send Fee Receipt via WhatsApp Desktop/i })).toBeDefined()
  })

  it('dispatches fee receipt via WhatsApp Desktop and downloads PDF voucher on click', async () => {
    const { openWhatsApp } = await import('../utils/whatsapp')
    const { downloadFeeVoucherPdf } = await import('../utils/feeVoucherPdf')

    render(<StudentDetailModal open={true} onClose={() => {}} student={mockStudent} />)

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /Loading/i })).toBeNull()
    })

    // Switch to Fees tab
    fireEvent.click(screen.getByRole('button', { name: /Fee Receipts & Invoices/i }))

    // Click Send Fee Receipt via WhatsApp Desktop
    const sendButton = screen.getByRole('button', {
      name: /Send Fee Receipt via WhatsApp Desktop/i,
    })
    fireEvent.click(sendButton)

    // 1. PDF download should be called
    expect(downloadFeeVoucherPdf).toHaveBeenCalled()

    // 2. WhatsApp Desktop should be invoked with target 'desktop'
    expect(openWhatsApp).toHaveBeenCalledWith(
      mockStudent.whatsapp_number,
      expect.stringContaining('HONOR KNOWLEDGE ACADEMY'),
      'desktop'
    )

    // 3. Confirmation banner is displayed
    expect(
      screen.getByText(/PDF Fee Voucher Generated & WhatsApp Launched!/i)
    ).toBeDefined()
  })

  it('allows switching WhatsApp target between Desktop, Web, and wa.me', async () => {
    const { openWhatsApp, setStoredWhatsAppTarget } = await import('../utils/whatsapp')

    render(<StudentDetailModal open={true} onClose={() => {}} student={mockStudent} />)

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /Loading/i })).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: /Fee Receipts & Invoices/i }))

    // Switch target to 'Web'
    const webButton = screen.getByRole('button', { name: /^Web$/i })
    fireEvent.click(webButton)
    expect(setStoredWhatsAppTarget).toHaveBeenCalledWith('web')

    // Click Send Fee Receipt
    const sendButton = screen.getByRole('button', {
      name: /Send Fee Receipt via WhatsApp Desktop/i,
    })
    fireEvent.click(sendButton)

    // Should now pass 'web' target
    expect(openWhatsApp).toHaveBeenCalledWith(
      mockStudent.whatsapp_number,
      expect.stringContaining('HONOR KNOWLEDGE ACADEMY'),
      'web'
    )
  })
})
