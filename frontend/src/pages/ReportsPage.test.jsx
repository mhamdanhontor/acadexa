import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReportsPage from './ReportsPage'
import * as reportsApi from '../api/reports'
import * as academicApi from '../api/academicStructure'
import * as clientApi from '../api/client'
import * as whatsappUtils from '../utils/whatsapp'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    hasRole: () => true,
    user: { full_name: 'Admin User', role_name: 'SUPER_ADMIN' },
  }),
}))

vi.mock('../api/reports', () => ({
  listReports: vi.fn(),
  generateReports: vi.fn(),
  approveReport: vi.fn(),
  sendReport: vi.fn(),
  approveAndSendReport: vi.fn(),
  approveAndSendAllReports: vi.fn(),
  getMonthEndReminder: vi.fn(),
  downloadReportPath: vi.fn((id) => `/api/v1/reports/${id}/download`),
}))

vi.mock('../api/academicStructure', () => ({
  listClasses: vi.fn(),
  listBatches: vi.fn(),
}))

vi.mock('../api/client', () => ({
  normalizeError: (err) => ({ message: err?.message || 'Error' }),
  downloadFile: vi.fn().mockResolvedValue(true),
}))

vi.mock('../utils/whatsapp', () => ({
  openWhatsApp: vi.fn(),
  getStoredWhatsAppTarget: vi.fn().mockReturnValue('desktop'),
  setStoredWhatsAppTarget: vi.fn(),
}))

describe('ReportsPage — WhatsApp Desktop & PDF Enhancements', () => {
  const mockReports = [
    {
      id: 101,
      student_id: 1,
      student_name: 'Muhammad Mudasir',
      student_code: 'HKA-0006',
      class_id: 1,
      class_name: 'Junior',
      batch_id: 1,
      batch_name: 'Evening',
      guardian_name: 'Nasir Aslam',
      whatsapp_number: '+923117296966',
      period_start: '2026-09-01',
      period_end: '2026-09-23',
      status: 'READY',
      data_json: JSON.stringify({
        attendance: { total_classes: 20, present: 19, late: 1, absent: 0, percentage: 100.0 },
        academics: { total_tests: 2, overall_percentage: 95.0, overall_grade: 'A+' },
      }),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    reportsApi.listReports.mockResolvedValue({ items: mockReports, total: 1, total_pages: 1 })
    reportsApi.getMonthEndReminder.mockResolvedValue({ is_reminder_active: false })
    academicApi.listClasses.mockResolvedValue([])
    academicApi.listBatches.mockResolvedValue([])
  })

  it('renders PDF button and WhatsApp Desktop button in table row', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Muhammad Mudasir')).toBeDefined()
    })

    // Check PDF button exists
    expect(screen.getByTitle('Download / View Official PDF Report')).toBeDefined()

    // Check WhatsApp Desktop button exists
    const waDesktopBtn = screen.getByTitle('Open directly in WhatsApp Desktop App')
    expect(waDesktopBtn).toBeDefined()
    expect(waDesktopBtn.textContent).toContain('WhatsApp Desktop')

    // Click WhatsApp Desktop button
    fireEvent.click(waDesktopBtn)
    expect(whatsappUtils.openWhatsApp).toHaveBeenCalledWith(
      '+923117296966',
      expect.stringContaining('MONTHLY PROGRESS REPORT'),
      'desktop'
    )
  })

  it('opens Approve & Send modal with WhatsApp dispatch options and allows switching target', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Muhammad Mudasir')).toBeDefined()
    })

    const approveSendBtn = screen.getByTitle('Approve and send report to WhatsApp immediately')
    fireEvent.click(approveSendBtn)

    // Modal opens
    expect(screen.getByText('Approve & Send Monthly Report')).toBeDefined()
    expect(screen.getByText('Choose WhatsApp Dispatch Option:')).toBeDefined()
    expect(screen.getByText('Desktop App')).toBeDefined()
    expect(screen.getByText('Opens web.whatsapp.com in browser')).toBeDefined()

    // Click WhatsApp Web option
    const webOption = screen.getByText('Opens web.whatsapp.com in browser').closest('button')
    fireEvent.click(webOption)

    expect(whatsappUtils.setStoredWhatsAppTarget).toHaveBeenCalledWith('web')
  })

  it('triggers PDF download when clicking PDF button', async () => {
    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Muhammad Mudasir')).toBeDefined()
    })

    const pdfBtn = screen.getByTitle('Download / View Official PDF Report')
    fireEvent.click(pdfBtn)

    expect(clientApi.downloadFile).toHaveBeenCalledWith(
      '/api/v1/reports/101/download',
      'monthly_report_HKA-0006.pdf'
    )
  })
})
