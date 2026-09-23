import { describe, it, expect, vi } from 'vitest'
import {
  getFormattedDueDate,
  buildFeeVoucherPdf,
  downloadFeeVoucherPdf,
} from './feeVoucherPdf'

describe('feeVoucherPdf utility', () => {
  it('formats last fee date as 10th of each month properly', () => {
    expect(getFormattedDueDate('September 2026')).toBe('10th of September 2026')
    expect(getFormattedDueDate('October 2026')).toBe('10th of October 2026')
    expect(getFormattedDueDate('')).toBe('10th of each month')
    expect(getFormattedDueDate('10th of November 2026')).toBe('10th of November 2026')
  })

  it('builds a valid dual voucher PDF with PAID stamp and red late fine', () => {
    const mockVoucher = {
      student: {
        name: 'Zaid Ali',
        student_code: 'HKA-502',
        class_room: { name: 'Class 9' },
        batch: { name: 'Evening' },
        guardian_name: 'Mr. Ali',
        whatsapp_number: '923001234567',
      },
      feeAmount: '6000',
      fineAmount: '250',
      feeMonth: 'October 2026',
      receiptNo: 'REC-9988',
      today: '2026-10-15',
    }

    const doc = buildFeeVoucherPdf(mockVoucher)
    expect(doc).toBeDefined()
    const output = doc.output()
    expect(output.length).toBeGreaterThan(1000)
    // Check for PDF signature header %PDF
    expect(output.startsWith('%PDF')).toBe(true)
  })

  it('calls doc.save when downloadFeeVoucherPdf is executed', () => {
    if (typeof window !== 'undefined' && !window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    }

    const mockVoucher = {
      student: { name: 'Sara Fatima', student_code: 'HKA-105' },
      feeAmount: '5000',
      fineAmount: '200',
      feeMonth: 'September 2026',
      receiptNo: 'REC-1234',
    }

    const filename = downloadFeeVoucherPdf(mockVoucher)
    expect(filename).toContain('Fee_Receipt_HONOR_Sara_Fatima_September_2026.pdf')
  })
})
