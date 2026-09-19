import { useEffect, useState } from 'react'
import { fetchDashboardSummary } from '../api/misc'
import { normalizeError } from '../api/client'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'

function StatCard({ icon, label, value, colorClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-lg ${colorClass}`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDashboardSummary()
      setSummary(data)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) return <ErrorAlert message={error} onRetry={load} />
  if (!summary) return null

  const recentActivity = summary.recent_activity || []

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Academy overview at a glance" />

      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Attendance Today</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard icon="fa-user-graduate" label="Total Students" value={summary.total_students ?? 0} colorClass="bg-indigo-100 text-indigo-600" />
        <StatCard icon="fa-check" label="Present Today" value={summary.present_today ?? 0} colorClass="bg-green-100 text-green-600" />
        <StatCard icon="fa-xmark" label="Absent Today" value={summary.absent_today ?? 0} colorClass="bg-red-100 text-red-600" />
        <StatCard icon="fa-clock" label="Late Today" value={summary.late_today ?? 0} colorClass="bg-yellow-100 text-yellow-600" />
        <StatCard icon="fa-percent" label="Attendance %" value={`${summary.attendance_percentage_today ?? 0}%`} colorClass="bg-blue-100 text-blue-600" />
      </div>

      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Notifications</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon="fa-paper-plane" label="Sent" value={summary.notifications_sent ?? 0} colorClass="bg-green-100 text-green-600" />
        <StatCard icon="fa-hourglass-half" label="Pending" value={summary.notifications_pending ?? 0} colorClass="bg-gray-100 text-gray-600" />
        <StatCard icon="fa-triangle-exclamation" label="Failed" value={summary.notifications_failed ?? 0} colorClass="bg-red-100 text-red-600" />
      </div>

      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Academics</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon="fa-file-pen" label="Tests This Month" value={summary.tests_this_month ?? 0} colorClass="bg-indigo-100 text-indigo-600" />
        <StatCard icon="fa-list-ol" label="Marks Entered" value={summary.marks_entered_this_month ?? 0} colorClass="bg-blue-100 text-blue-600" />
        <StatCard icon="fa-file-circle-exclamation" label="Pending Reports" value={summary.pending_reports ?? 0} colorClass="bg-yellow-100 text-yellow-600" />
      </div>

      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Recent Activity</h3>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {recentActivity.length === 0 ? (
          <EmptyState title="No recent activity" />
        ) : (
          recentActivity.map((item) => (
            <div key={item.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-800">{item.action.replace(/_/g, ' ')}</span>
                {item.description && <span className="text-gray-500 ml-2">{item.description}</span>}
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-4">
                {new Date(item.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
