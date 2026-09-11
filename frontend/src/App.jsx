import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClassesPage from './pages/ClassesPage'
import BatchesPage from './pages/BatchesPage'
import SubjectsPage from './pages/SubjectsPage'
import ComingSoonPage from './pages/ComingSoonPage'

export default function App() {
  return (
    <BrowserRouter>
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
            <Route path="classes" element={<ClassesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="subjects" element={<SubjectsPage />} />

            {/* Remaining modules: implemented on the backend (API layer ready),
                UI pages are placeholders pending the next build pass. */}
            <Route path="students" element={<ComingSoonPage title="Students" />} />
            <Route path="attendance" element={<ComingSoonPage title="Attendance" />} />
            <Route path="tests" element={<ComingSoonPage title="Tests" />} />
            <Route path="marks" element={<ComingSoonPage title="Marks" />} />
            <Route path="reports" element={<ComingSoonPage title="Reports" />} />
            <Route path="notifications" element={<ComingSoonPage title="Notifications" />} />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN']}>
                  <ComingSoonPage title="Users & Roles" />
                </ProtectedRoute>
              }
            />
            <Route
              path="backups"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                  <ComingSoonPage title="Backups" />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit-logs"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                  <ComingSoonPage title="Audit Logs" />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}>
                  <ComingSoonPage title="Settings" />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
