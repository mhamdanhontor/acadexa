import { useEffect, useState } from 'react'
import { listClasses, createClass, updateClass, setClassStatus } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'

export default function ClassesPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [classes, setClasses] = useState([])
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
      const data = await listClasses({ page_size: 100 })
      setClasses(Array.isArray(data) ? data : (data?.items || []))
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

  function openEdit(cls) {
    setEditing(cls)
    setForm({ name: cls.name, description: cls.description || '' })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await updateClass(editing.id, form)
      } else {
        await createClass(form)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(cls) {
    try {
      await setClassStatus(cls.id, !cls.is_active)
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Classes"
        subtitle="Manage academic classes (e.g. 9th, 10th, 11th)"
        actions={
          canManage && (
            <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
              <i className="fas fa-plus mr-2"></i>Add Class
            </button>
          )
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (classes || []).length === 0 ? (
          <EmptyState title="No classes yet" subtitle="Create your first class to get started." icon="fa-school" />
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
              {(classes || []).map((cls) => (
                <tr key={cls.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{cls.name}</td>
                  <td className="px-5 py-3 text-gray-500">{cls.description || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={cls.is_active} /></td>
                  {canManage && (
                    <td className="px-5 py-3 text-right space-x-3">
                      <button onClick={() => openEdit(cls)} className="text-indigo-600 hover:text-indigo-800">
                        Edit
                      </button>
                      <button onClick={() => toggleStatus(cls)} className="text-gray-500 hover:text-gray-700">
                        {cls.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Class' : 'Add Class'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 10th"
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
