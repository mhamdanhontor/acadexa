import { useEffect, useState } from 'react'
import { listBatches, createBatch, updateBatch, setBatchStatus } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function BatchesPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listBatches({ page_size: 100 })
      setBatches(Array.isArray(data) ? data : (data?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(batch) {
    setEditing(batch)
    setForm({ name: batch.name, description: batch.description || '' })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await updateBatch(editing.id, form)
      } else {
        await createBatch(form)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(batch) {
    try {
      await setBatchStatus(batch.id, !batch.is_active)
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Batches"
        subtitle="Manage academy batches (e.g. Morning, Evening)"
        actions={
          canManage && (
            <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
              <i className="fas fa-plus mr-2"></i>Add Batch
            </button>
          )
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (batches || []).length === 0 ? (
          <EmptyState title="No batches yet" subtitle="Create your first batch to get started." icon="fa-layer-group" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {canManage && <th className="px-5 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(batches || []).map((batch) => (
                <tr key={batch.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{batch.name}</td>
                  <td className="px-5 py-3 text-gray-500">{batch.description || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={batch.is_active} /></td>
                  {canManage && (
                    <td className="px-5 py-3 text-right space-x-3">
                      <button onClick={() => openEdit(batch)} className="text-indigo-600 hover:text-indigo-800">
                        Edit
                      </button>
                      <button onClick={() => toggleStatus(batch)} className="text-gray-500 hover:text-gray-700">
                        {batch.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Batch' : 'Add Batch'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Morning"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
