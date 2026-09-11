import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClassesPage from './pages/ClassesPage'
import BatchesPage from './pages/BatchesPage'
import SubjectsPage from './pages/SubjectsPage'
import StudentsPage from './pages/StudentsPage'
import AttendancePage from './pages/AttendancePage'
import TestsPage from './pages/TestsPage'
import MarksPage from './pages/MarksPage'
import ReportsPage from './pages/ReportsPage'
import NotificationsPage from './pages/NotificationsPage'
import UsersPage from './pages/UsersPage'
import BackupsPage from './pages/BackupsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="tests" element={<TestsPage />} />
            <Route path="marks" element={<MarksPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="backups"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                  <BackupsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  )
}
