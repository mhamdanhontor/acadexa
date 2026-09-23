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
  listAttendance: vi.fn().mockResolvedValue([]),
  getAttendanceSummary: vi.fn().mockResolvedValue(null),
}))

vi.mock('../api/academics', () => ({
  listMarks: vi.fn().mockResolvedValue([]),
}))

describe('StudentDetailModal — Fee Voucher & WhatsApp Desktop Integration', () => {
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

  it('renders Fees tab with Honor Knowledge Academy branding, 10th due date, and red late fine', async () => {
    render(<StudentDetailModal open={true} onClose={() => {}} student={mockStudent} />)

    // Wait for student history loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /Loading/i })).toBeNull()
    })

    // Switch to Fees tab
    const feeTabButton = screen.getByRole('button', { name: /Fee Receipts & Invoices/i })
    fireEvent.click(feeTabButton)

    // 1. Check Honor Knowledge Academy header & title
    expect(screen.getAllByText(/Honor Knowledge Academy/i).length).toBeGreaterThan(0)

    // 2. Check Last Fee Date 10th of each month is displayed
    expect(screen.getAllByText(/Last Fee Date: 10th of each month/i).length).toBeGreaterThan(0)

    // 3. Check Late Fee / Fine in Red is displayed
    expect(screen.getByText(/Late Fee \/ Fine \(PKR\)/i)).toBeDefined()
    expect(screen.getByText(/RED IN VOUCHER/i)).toBeDefined()
    expect(screen.getByText(/APPLIED IN RED/i)).toBeDefined()

    // 4. Check "Honor Knowledge Academy" PAID Rubber Stamp
    expect(screen.getByText('★ PAID ★')).toBeDefined()
    expect(screen.getByText(/Official Academy Paid Stamp/i)).toBeDefined()

    // 5. Check WhatsApp Desktop is selected by default
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
      screen.getByText(/PDF Fee Voucher Generated & WhatsApp Desktop Launched!/i)
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
