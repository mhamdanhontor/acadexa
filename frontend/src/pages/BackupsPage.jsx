import { useEffect, useState } from 'react'
import { listBackups, createBackup, restoreBackup, downloadBackupPath } from '../api/misc'
import { normalizeError, downloadFile } from '../api/client'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'

export default function BackupsPage() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  const [confirmRestore, setConfirmRestore] = useState(null)
  const [restoreText, setRestoreText] = useState('')
  const [restoring, setRestoring] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listBackups()
      setBackups(Array.isArray(data) ? data : (data?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      await createBackup()
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    setError(null)
    try {
      await restoreBackup(confirmRestore.id, true)
      setConfirmRestore(null)
      setRestoreText('')
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setRestoring(false)
    }
  }

  async function handleDownload(backup) {
    setError(null)
    try {
      await downloadFile(downloadBackupPath(backup.id), backup.file_name)
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '—'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  return (
    <div>
      <PageHeader
        title="Backups"
        subtitle="Create and restore full database backups (Super Admin only for restore/create)"
        actions={
          <button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md flex items-center gap-2">
            {creating && <Spinner size="sm" />}
            <i className="fas fa-database"></i>
            {creating ? 'Creating...' : 'Create Backup Now'}
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 px-4 py-3 text-sm">
        <i className="fas fa-triangle-exclamation mr-2"></i>
        Restoring a backup replaces ALL current data with the backup's contents. This cannot be undone.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (backups || []).length === 0 ? (
          <EmptyState title="No backups yet" subtitle="Create your first backup." icon="fa-database" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">File Name</th>
                <th className="px-5 py-3 font-medium">Size</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(backups || []).map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{b.file_name}</td>
                  <td className="px-5 py-3 text-gray-600">{formatSize(b.file_size_bytes)}</td>
                  <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3 text-right space-x-3">
                    {b.status === 'COMPLETED' && (
                      <>
                        <button onClick={() => handleDownload(b)} className="text-indigo-600 hover:text-indigo-800">Download</button>
                        <button onClick={() => setConfirmRestore(b)} className="text-red-600 hover:text-red-800">Restore</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmRestore && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-red-700 mb-2">
              <i className="fas fa-triangle-exclamation mr-2"></i>Confirm Database Restore
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently overwrite ALL current data with backup <strong>{confirmRestore.file_name}</strong>. Type <strong>RESTORE</strong> to confirm.
            </p>
            <input
              value={restoreText}
              onChange={(e) => setRestoreText(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
              placeholder="Type RESTORE"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setConfirmRestore(null); setRestoreText('') }} className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreText !== 'RESTORE' || restoring}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40"
              >
                {restoring ? 'Restoring...' : 'Restore Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
