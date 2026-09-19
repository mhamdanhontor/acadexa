import { useEffect, useState } from 'react'
import { listTestSessions, createTestSession, listTests, createTest } from '../api/academics'
import { listClasses, listBatches, listSubjects } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

const EMPTY_SESSION_FORM = { name: '', start_date: '', end_date: '', period_count: 4 }
const EMPTY_TEST_FORM = {
  session_id: '',
  period_label: '',
  subject_id: '',
  class_id: '',
  batch_id: '',
  name: '',
  test_date: '',
  total_marks: 100,
}

export default function TestsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN', 'TEACHER')

  const [sessions, setSessions] = useState([])
  const [tests, setTests] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sessionFilter, setSessionFilter] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION_FORM)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testForm, setTestForm] = useState(EMPTY_TEST_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [s, c, b, subj] = await Promise.all([
        listTestSessions(),
        listClasses({ page_size: 100 }),
        listBatches({ page_size: 100 }),
        listSubjects({ page_size: 100 }),
      ])
      setSessions(Array.isArray(s) ? s : (s?.items || []))
      setClasses(Array.isArray(c) ? c : (c?.items || []))
      setBatches(Array.isArray(b) ? b : (b?.items || []))
      setSubjects(Array.isArray(subj) ? subj : (subj?.items || []))
      await loadTests(sessionFilter)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTests(sessionId) {
    try {
      const params = {}
      if (sessionId) params.session_id = sessionId
      const t = await listTests(params)
      setTests(Array.isArray(t) ? t : (t?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadTests(sessionFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFilter])

  async function handleCreateSession(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await createTestSession({ ...sessionForm, period_count: Number(sessionForm.period_count) })
      setSessionModalOpen(false)
      setSessionForm(EMPTY_SESSION_FORM)
      loadAll()
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  function openCreateTest() {
    setTestForm({ ...EMPTY_TEST_FORM, session_id: sessionFilter || '' })
    setFormError('')
    setTestModalOpen(true)
  }

  async function handleCreateTest(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await createTest({
        ...testForm,
        session_id: Number(testForm.session_id),
        subject_id: Number(testForm.subject_id),
        class_id: Number(testForm.class_id),
        batch_id: Number(testForm.batch_id),
        total_marks: Number(testForm.total_marks),
      })
      setTestModalOpen(false)
      loadTests(sessionFilter)
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const sessionName = (id) => (sessions || []).find((s) => s.id === id)?.name || '—'
  const className = (id) => (classes || []).find((c) => c.id === id)?.name || '—'
  const batchName = (id) => (batches || []).find((b) => b.id === id)?.name || '—'
  const subjectName = (id) => (subjects || []).find((s) => s.id === id)?.name || '—'

  return (
    <div>
      <PageHeader
        title="Tests"
        subtitle="Manage test sessions and tests/exams"
        actions={
          canManage && (
            <div className="flex gap-2">
              <button onClick={() => setSessionModalOpen(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-md">
                <i className="fas fa-plus mr-2"></i>New Session
              </button>
              <button onClick={openCreateTest} disabled={sessions.length === 0} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md">
                <i className="fas fa-plus mr-2"></i>New Test
              </button>
            </div>
          )
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={loadAll} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Test Session</label>
        <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : tests.length === 0 ? (
          <EmptyState title="No tests yet" subtitle="Create a test session, then add tests." icon="fa-file-pen" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Test Name</th>
                <th className="px-5 py-3 font-medium">Session</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Class / Batch</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Total Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tests.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{t.name}</td>
                  <td className="px-5 py-3 text-gray-600">{sessionName(t.session_id)}</td>
                  <td className="px-5 py-3 text-gray-600">{t.period_label}</td>
                  <td className="px-5 py-3 text-gray-600">{subjectName(t.subject_id)}</td>
                  <td className="px-5 py-3 text-gray-600">{className(t.class_id)} / {batchName(t.batch_id)}</td>
                  <td className="px-5 py-3 text-gray-600">{t.test_date}</td>
                  <td className="px-5 py-3 text-gray-600">{t.total_marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={sessionModalOpen} title="New Test Session" onClose={() => setSessionModalOpen(false)}>
        <form onSubmit={handleCreateSession} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Name</label>
            <input required value={sessionForm.name} onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
              placeholder="e.g. Term 1 2026" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input required type="date" value={sessionForm.start_date} onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input required type="date" value={sessionForm.end_date} onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Periods</label>
            <input required type="number" min="1" max="24" value={sessionForm.period_count}
              onChange={(e) => setSessionForm({ ...sessionForm, period_count: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Configurable per requirement #22 — not hardcoded to 4.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSessionModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={testModalOpen} title="New Test" onClose={() => setTestModalOpen(false)} width="max-w-lg">
        <form onSubmit={handleCreateTest} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Session</label>
            <select required value={testForm.session_id} onChange={(e) => setTestForm({ ...testForm, session_id: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select session</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
              <input required value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Unit Test 1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Label</label>
              <input required value={testForm.period_label} onChange={(e) => setTestForm({ ...testForm, period_label: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="e.g. Period 1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select required value={testForm.subject_id} onChange={(e) => setTestForm({ ...testForm, subject_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select subject</option>
                {(subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
              <input required type="date" value={testForm.test_date} onChange={(e) => setTestForm({ ...testForm, test_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select required value={testForm.class_id} onChange={(e) => setTestForm({ ...testForm, class_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select class</option>
                {(classes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select required value={testForm.batch_id} onChange={(e) => setTestForm({ ...testForm, batch_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select batch</option>
                {(batches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
              <input required type="number" min="1" step="0.5" value={testForm.total_marks}
                onChange={(e) => setTestForm({ ...testForm, total_marks: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setTestModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
