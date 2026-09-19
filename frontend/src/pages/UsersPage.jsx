import { useEffect, useState } from 'react'
import { listUsers, listRoles, createUser, updateUser, setUserStatus } from '../api/users'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'

const EMPTY_FORM = { full_name: '', email: '', role_id: '', password: '' }

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadRoles() {
    try {
      const roles = await listRoles()
      setRoles(Array.isArray(roles) ? roles : (roles?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers({ page, page_size: pageSize })
      setUsers(Array.isArray(data) ? data : (data?.items || []))
      setTotal(data?.total ?? 0)
      setTotalPages(data?.total_pages ?? 1)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(u) {
    setEditing(u)
    setForm({ full_name: u.full_name, email: u.email, role_id: u.role?.id || u.role_id || '', password: '' })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const payload = { full_name: form.full_name, role_id: Number(form.role_id) }
        if (form.password) payload.password = form.password
        await updateUser(editing.id, payload)
      } else {
        await createUser({ ...form, role_id: Number(form.role_id) })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(u) {
    setError(null)
    try {
      await setUserStatus(u.id, !u.is_active)
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Manage staff accounts (Super Admin only)"
        actions={
          <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
            <i className="fas fa-plus mr-2"></i>Add User
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : users.length === 0 ? (
          <EmptyState title="No users found" icon="fa-users-gear" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{u.full_name}</td>
                  <td className="px-5 py-3 text-gray-600">{u.email}</td>
                  <td className="px-5 py-3 text-gray-600">{u.role?.name || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={u.is_active} /></td>
                  <td className="px-5 py-3 text-right space-x-3">
                    <button onClick={() => openEdit(u)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                    <button
                      onClick={() => toggleStatus(u)}
                      disabled={u.id === currentUser?.id}
                      className="text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={u.id === currentUser?.id ? 'You cannot deactivate your own account' : ''}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit User' : 'Add User'} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input required type="email" disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editing ? 'New Password (leave blank to keep current)' : 'Password'}
            </label>
            <input
              required={!editing}
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
