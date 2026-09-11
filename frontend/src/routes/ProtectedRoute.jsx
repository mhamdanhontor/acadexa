import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading, hasRole } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !hasRole(...roles)) {
    return (
      <div className="p-10 text-center text-gray-500">
        <i className="fas fa-lock text-3xl mb-3"></i>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  return children
}
