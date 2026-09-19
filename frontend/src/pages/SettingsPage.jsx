import { useEffect, useState } from 'react'
import { fetchSettings, updateSettings, exportStudentsPath, exportAttendancePath, exportMarksPath } from '../api/misc'
import { normalizeError, downloadFile } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'

export default function SettingsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setForm(await fetchSettings())
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSuccessMsg('')
    setError(null)
    try {
      const updated = await updateSettings(form)
      setForm(updated)
      setSuccessMsg('Settings saved.')
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleExport(pathFn, filename) {
    setError(null)
    try {
      await downloadFile(pathFn(), filename)
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Academy configuration and data export" />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}
      {successMsg && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
          <i className="fas fa-circle-check mr-2"></i>{successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 mb-6 max-w-xl">
        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">Academy Details</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Academy Name</label>
          <input disabled={!canManage} value={form?.academy_name || ''} onChange={(e) => setForm({ ...form, academy_name: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input disabled={!canManage} value={form?.academy_address || ''} onChange={(e) => setForm({ ...form, academy_address: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
          <input disabled={!canManage} value={form?.academy_contact || ''} onChange={(e) => setForm({ ...form, academy_contact: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input disabled={!canManage} value={form?.academy_logo_url || ''} onChange={(e) => setForm({ ...form, academy_logo_url: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="late-counts-present-checkbox"
            type="checkbox"
            disabled={!canManage}
            checked={form?.attendance_late_counts_as_present === 'true'}
            onChange={(e) => setForm({ ...form, attendance_late_counts_as_present: e.target.checked ? 'true' : 'false' })}
            className="rounded border-gray-300"
          />
          <label htmlFor="late-counts-present-checkbox" className="text-sm text-gray-700">
            Count "Late" as "Present" for attendance percentage calculations
          </label>
        </div>
        {canManage && (
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </form>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl">
        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-4">Data Export</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => handleExport(exportStudentsPath, 'students_export.xlsx')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-md">
            <i className="fas fa-file-excel mr-2"></i>Export Students
          </button>
          <button onClick={() => handleExport(exportAttendancePath, 'attendance_export.xlsx')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-md">
            <i className="fas fa-file-excel mr-2"></i>Export Attendance
          </button>
          <button onClick={() => handleExport(exportMarksPath, 'marks_export.xlsx')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-md">
            <i className="fas fa-file-excel mr-2"></i>Export Marks
          </button>
        </div>
      </div>
    </div>
  )
}
