import { useEffect, useState } from 'react'
import { listStudents, createStudent, updateStudent, setStudentStatus, deleteStudent } from '../api/students'
import { listClasses, listBatches } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import StudentDetailModal from '../components/StudentDetailModal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

const EMPTY_FORM = {
  student_code: '',
  name: '',
  name_ur: '',
  guardian_name: '',
  guardian_name_ur: '',
  whatsapp_number: '',
  class_id: '',
  batch_id: '',
  admission_date: '',
  notes: '',
}

export default function StudentsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)
  const [classFilter, setClassFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  const [modalOpen, setModalOpen] = useState(false)
  const [detailStudent, setDetailStudent] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '', loading: false })

  function confirmDelete(student) {
    setDeleteModal({ open: true, id: student.id, name: student.name, loading: false })
  }

  async function handleDeleteConfirm() {
    setDeleteModal((prev) => ({ ...prev, loading: true }))
    try {
      await deleteStudent(deleteModal.id)
      setDeleteModal({ open: false, id: null, name: '', loading: false })
      load()
    } catch (err) {
      setError(normalizeError(err).message)
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    }
  }

  async function loadLookups() {
    try {
      const [c, b] = await Promise.all([listClasses({ page_size: 100 }), listBatches({ page_size: 100 })])
      setClasses(Array.isArray(c) ? c : (c?.items || []))
      setBatches(Array.isArray(b) ? b : (b?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: pageSize }
      if (debouncedSearch) params.search = debouncedSearch
      if (classFilter) params.class_id = classFilter
      if (batchFilter) params.batch_id = batchFilter
      if (statusFilter !== '') params.is_active = statusFilter
      const data = await listStudents(params)
      setStudents(Array.isArray(data) ? data : (data?.items || []))
      setTotal(data?.total ?? 0)
      setTotalPages(data?.total_pages ?? 1)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, classFilter, batchFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, classFilter, batchFilter, statusFilter])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(student) {
    setEditing(student)
    setForm({
      student_code: student.student_code,
      name: student.name,
      name_ur: student.name_ur || '',
      guardian_name: student.guardian_name || '',
      guardian_name_ur: student.guardian_name_ur || '',
      whatsapp_number: student.whatsapp_number,
      class_id: student.class_id,
      batch_id: student.batch_id,
      admission_date: student.admission_date || '',
      notes: student.notes || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        name_ur: form.name_ur?.trim() || null,
        guardian_name: form.guardian_name?.trim() || null,
        guardian_name_ur: form.guardian_name_ur?.trim() || null,
        class_id: Number(form.class_id),
        batch_id: Number(form.batch_id),
        admission_date: form.admission_date || null,
      }
      if (editing) {
        delete payload.student_code // student_code is not editable per StudentUpdate schema
        await updateStudent(editing.id, payload)
      } else {
        delete payload.student_code // backend auto-generates unique Student ID
        await createStudent(payload)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(student) {
    try {
      await setStudentStatus(student.id, !student.is_active)
      load()
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Manage student records"
        actions={
          canManage && (
            <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
              <i className="fas fa-plus mr-2"></i>Add Student
            </button>
          )
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex flex-wrap gap-3">
        <input
          id="student-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, student ID, or WhatsApp number..."
          className="flex-1 min-w-[220px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (students || []).length === 0 ? (
          <EmptyState title="No students found" subtitle="Try adjusting filters or add a new student." icon="fa-user-graduate" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Student ID</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Class / Batch</th>
                <th className="px-5 py-3 font-medium">WhatsApp</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(students || []).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setDetailStudent(s)}
                      className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-900 hover:underline flex items-center gap-1"
                      title="Click to view 360° Attendance & Fee Record"
                    >
                      <i className="fas fa-id-badge text-gray-400"></i>
                      {s.student_code}
                    </button>
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    <button
                      onClick={() => setDetailStudent(s)}
                      className="text-left font-semibold text-gray-900 hover:text-indigo-600 hover:underline flex items-center gap-2 flex-wrap"
                      title="Click to view 360° Attendance & Fee Record"
                    >
                      <span>{s.name}</span>
                      {s.name_ur && (
                        <span className="text-xs font-normal text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-serif">
                          {s.name_ur}
                        </span>
                      )}
                    </button>
                    {(s.guardian_name || s.guardian_name_ur) && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Guardian: <span className="text-gray-600">{s.guardian_name || '—'}</span>
                        {s.guardian_name_ur && (
                          <span className="ml-1 text-gray-500 font-serif">({s.guardian_name_ur})</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {s.class_room?.name || '—'} / {s.batch?.name || '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{s.whatsapp_number}</td>
                  <td className="px-5 py-3"><StatusBadge status={s.is_active} /></td>
                  <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => setDetailStudent(s)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      title="View full attendance & fee record"
                    >
                      <i className="fas fa-folder-open text-xs"></i>
                      <span>Record</span>
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                          Edit
                        </button>
                        <button onClick={() => toggleStatus(s)} className="text-gray-500 hover:text-gray-700 text-xs">
                          {s.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => confirmDelete(s)} className="text-red-500 hover:text-red-700 text-xs font-medium">
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Student' : 'Add Student'} onClose={() => setModalOpen(false)} width="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student ID <span className="text-xs font-normal text-gray-400">{editing ? '' : '(Auto-generated)'}</span>
              </label>
              <input
                disabled
                value={editing ? form.student_code : 'Auto-generated upon save'}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 disabled:bg-gray-100 italic"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (English)</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name in Urdu <span className="text-xs font-normal text-gray-400">(Optional - auto-generated if blank)</span>
              </label>
              <input
                dir="rtl"
                placeholder="مثال: محمد احمد"
                value={form.name_ur}
                onChange={(e) => setForm({ ...form, name_ur: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name (English)</label>
              <input
                value={form.guardian_name}
                onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Guardian Name in Urdu <span className="text-xs font-normal text-gray-400">(Optional)</span>
              </label>
              <input
                dir="rtl"
                placeholder="مثال: بشیر احمد"
                value={form.guardian_name_ur}
                onChange={(e) => setForm({ ...form, guardian_name_ur: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-right"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <input
                required
                value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                placeholder="+9198xxxxxxx"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                required
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select
                required
                value={form.batch_id}
                onChange={(e) => setForm({ ...form, batch_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date</label>
              <input
                type="date"
                value={form.admission_date}
                onChange={(e) => setForm({ ...form, admission_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
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

      {detailStudent && (
        <StudentDetailModal
          open={Boolean(detailStudent)}
          onClose={() => setDetailStudent(null)}
          student={detailStudent}
        />
      )}

      <ConfirmDeleteModal
        open={deleteModal.open}
        title="Delete Student"
        itemName={deleteModal.name}
        message="Are you sure you want to deactivate / remove this student from active records?"
        loading={deleteModal.loading}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteModal({ open: false, id: null, name: '', loading: false })}
      />
    </div>
  )
}
