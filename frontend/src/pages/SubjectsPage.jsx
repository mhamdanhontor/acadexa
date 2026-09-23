import { useEffect, useState } from 'react'
import { listSubjects, createSubject, setSubjectStatus, deleteSubject } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

export default function SubjectsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '', loading: false })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listSubjects({ page_size: 100 })
      setSubjects(Array.isArray(data) ? data : (data?.items || []))
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
    setFormError('')
    try {
      await createSubject({ name })
      setModalOpen(false)
      setName('')
      load()
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(subj) {
    try {
      await setSubjectStatus(subj.id, !subj.is_active)
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  function confirmDelete(subj) {
    setDeleteModal({ open: true, id: subj.id, name: subj.name, loading: false })
  }

  async function handleDeleteConfirm() {
    setDeleteModal((prev) => ({ ...prev, loading: true }))
    try {
      await deleteSubject(deleteModal.id)
      setDeleteModal({ open: false, id: null, name: '', loading: false })
      load()
    } catch (err) {
      setError(normalizeError(err).message)
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    }
  }

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle="Manage subjects used for tests and marks"
        actions={
          canManage && (
            <button onClick={() => setModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
              <i className="fas fa-plus mr-2"></i>Add Subject
            </button>
          )
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (subjects || []).length === 0 ? (
          <EmptyState title="No subjects yet" subtitle="Create your first subject to get started." icon="fa-book" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {canManage && <th className="px-5 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(subjects || []).map((subj) => (
                <tr key={subj.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{subj.name}</td>
                  <td className="px-5 py-3"><StatusBadge status={subj.is_active} /></td>
                  {canManage && (
                    <td className="px-5 py-3 text-right space-x-3">
                      <button onClick={() => toggleStatus(subj)} className="text-gray-500 hover:text-gray-700">
                        {subj.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => confirmDelete(subj)} className="text-red-500 hover:text-red-700">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} title="Add Subject" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Mathematics"
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

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Subject"
        itemName={deleteModal.name}
        message="Are you sure you want to delete this subject? All tests and marks under this subject will also be deleted."
        loading={deleteModal.loading}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteModal({ open: false, id: null, name: '', loading: false })}
      />
    </div>
  )
}
