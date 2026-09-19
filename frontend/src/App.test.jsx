import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

afterEach(() => {
  cleanup()
})

// Mock context and client
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, full_name: 'Admin User', role_name: 'SUPER_ADMIN', email: 'admin@acadexa.com' },
    hasRole: () => true,
    hasPermission: () => true,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }) => <div>{children}</div>,
}))

vi.mock('./api/academicStructure', () => ({
  listClasses: vi.fn().mockResolvedValue({ items: [{ id: 1, name: 'Class 10', is_active: true }] }),
  listBatches: vi.fn().mockResolvedValue({ items: [{ id: 1, name: 'Morning', is_active: true }] }),
  listSubjects: vi.fn().mockResolvedValue([{ id: 1, name: 'Physics', is_active: true }]),
  createClass: vi.fn(),
  updateClass: vi.fn(),
  setClassStatus: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  setBatchStatus: vi.fn(),
  createSubject: vi.fn(),
  setSubjectStatus: vi.fn(),
}))

vi.mock('./api/students', () => ({
  listStudents: vi.fn().mockResolvedValue({ items: [{ id: 1, name: 'John Doe', student_code: 'STD-1', is_active: true }] }),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  setStudentStatus: vi.fn(),
}))

vi.mock('./api/attendance', () => ({
  getAttendanceByDate: vi.fn().mockResolvedValue([]),
  saveBulkAttendance: vi.fn(),
  getAllEnrolledAttendance: vi.fn().mockResolvedValue([
    {
      student_id: 1,
      student_code: 'STD-1',
      student_name: 'John Doe',
      guardian_name: 'Jane Doe',
      whatsapp_number: '923001234567',
      class_id: 1,
      class_name: 'Class 10',
      batch_id: 1,
      batch_name: 'Morning',
      current_status: 'PRESENT',
    },
  ]),
  saveAllEnrolledAttendance: vi.fn().mockResolvedValue({
    date: '2026-09-19',
    total: 1,
    present: 1,
    absent: 0,
    late: 0,
    leave: 0,
    notifications_queued: 0,
    dispatches: [],
  }),
}))

vi.mock('./api/academics', () => ({
  listTestSessions: vi.fn().mockResolvedValue([{ id: 1, name: 'Term 1' }]),
  listTests: vi.fn().mockResolvedValue([{ id: 1, name: 'Midterm', period_label: 'P1', total_marks: 100, class_id: 1, batch_id: 1 }]),
  listMarks: vi.fn().mockResolvedValue({ items: [] }),
  saveBulkMarks: vi.fn(),
}))

vi.mock('./api/reports', () => ({
  listReports: vi.fn().mockResolvedValue({ items: [] }),
  generateReports: vi.fn(),
}))

vi.mock('./api/notifications', () => ({
  listNotifications: vi.fn().mockResolvedValue({ items: [] }),
  listTemplates: vi.fn().mockResolvedValue([]),
}))

vi.mock('./api/users', () => ({
  listUsers: vi.fn().mockResolvedValue({ items: [{ id: 1, full_name: 'Admin', email: 'admin@acadexa.com', role: { id: 1, name: 'SUPER_ADMIN' }, is_active: true }] }),
  listRoles: vi.fn().mockResolvedValue([{ id: 1, name: 'SUPER_ADMIN' }]),
}))

vi.mock('./api/misc', () => ({
  fetchDashboardSummary: vi.fn().mockResolvedValue({
    total_students: 2,
    present_today: 0,
    absent_today: 0,
    late_today: 0,
    leave_today: 0,
    attendance_percentage_today: 0,
    notifications_sent: 0,
    notifications_pending: 0,
    notifications_failed: 0,
    tests_this_month: 0,
    marks_entered_this_month: 0,
    pending_reports: 0,
    recent_activity: [],
  }),
  listAuditLogs: vi.fn().mockResolvedValue({ items: [] }),
  listBackups: vi.fn().mockResolvedValue([]),
  fetchSettings: vi.fn().mockResolvedValue({
    academy_name: 'Honor knowledge Academy',
    academy_address: '',
    academy_contact: '',
    academy_logo_url: '',
    attendance_late_counts_as_present: 'false',
  }),
  exportStudentsPath: () => '/exports/students',
  exportAttendancePath: () => '/exports/attendance',
  exportMarksPath: () => '/exports/marks',
}))

import DashboardPage from './pages/DashboardPage'
import StudentsPage from './pages/StudentsPage'
import ClassesPage from './pages/ClassesPage'
import BatchesPage from './pages/BatchesPage'
import SubjectsPage from './pages/SubjectsPage'
import AttendancePage from './pages/AttendancePage'
import QuickAttendancePage from './pages/QuickAttendancePage'
import TestsPage from './pages/TestsPage'
import MarksPage from './pages/MarksPage'
import ReportsPage from './pages/ReportsPage'
import NotificationsPage from './pages/NotificationsPage'
import UsersPage from './pages/UsersPage'
import BackupsPage from './pages/BackupsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

describe('All Pages Render Without Crashing', () => {
  it('renders DashboardPage', async () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(await screen.findByText('Dashboard')).toBeDefined()
  })

  it('renders StudentsPage', async () => {
    render(<MemoryRouter><StudentsPage /></MemoryRouter>)
    expect(await screen.findByText('Students')).toBeDefined()
  })

  it('renders ClassesPage', async () => {
    render(<MemoryRouter><ClassesPage /></MemoryRouter>)
    expect(await screen.findByText('Classes')).toBeDefined()
  })

  it('renders BatchesPage', async () => {
    render(<MemoryRouter><BatchesPage /></MemoryRouter>)
    expect(await screen.findByText('Batches')).toBeDefined()
  })

  it('renders SubjectsPage', async () => {
    render(<MemoryRouter><SubjectsPage /></MemoryRouter>)
    expect(await screen.findByText('Subjects')).toBeDefined()
  })

  it('renders AttendancePage', async () => {
    render(<MemoryRouter><AttendancePage /></MemoryRouter>)
    expect(await screen.findByText('Attendance')).toBeDefined()
  })

  it('renders QuickAttendancePage', async () => {
    render(<MemoryRouter><QuickAttendancePage /></MemoryRouter>)
    expect(await screen.findByText('All Students Attendance')).toBeDefined()
  })

  it('renders TestsPage', async () => {
    render(<MemoryRouter><TestsPage /></MemoryRouter>)
    expect(await screen.findByText('Tests')).toBeDefined()
  })

  it('renders MarksPage', async () => {
    render(<MemoryRouter><MarksPage /></MemoryRouter>)
    expect(await screen.findByText('Marks')).toBeDefined()
  })

  it('renders ReportsPage', async () => {
    render(<MemoryRouter><ReportsPage /></MemoryRouter>)
    expect(await screen.findByText('Reports')).toBeDefined()
  })

  it('renders NotificationsPage', async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeDefined()
  })

  it('renders UsersPage', async () => {
    render(<MemoryRouter><UsersPage /></MemoryRouter>)
    expect(await screen.findByText('Users & Roles')).toBeDefined()
  })

  it('renders BackupsPage', async () => {
    render(<MemoryRouter><BackupsPage /></MemoryRouter>)
    expect(await screen.findByText('Backups')).toBeDefined()
  })

  it('renders AuditLogsPage', async () => {
    render(<MemoryRouter><AuditLogsPage /></MemoryRouter>)
    expect(await screen.findByText('Audit Logs')).toBeDefined()
  })

  it('renders SettingsPage', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(await screen.findByText('Settings')).toBeDefined()
  })

  it('renders LoginPage', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(await screen.findByText('Honor Knowledge Academy')).toBeDefined()
  })
})
