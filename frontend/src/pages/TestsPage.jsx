import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listTestSessions,
  createTestSession,
  deleteTestSession,
  listTests,
  createTest,
  deleteTest,
} from '../api/academics'
import { listClasses, listBatches, listSubjects } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

const EMPTY_SESSION_FORM = { name: '', start_date: '', end_date: '', period_count: 4 }
const EMPTY_TEST_FORM = {
  session_id: '',
  period_label: 'Period 1',
  subject_id: '',
  class_id: '',
  batch_id: '',
  name: '',
  test_date: new Date().toISOString().slice(0, 10),
  total_marks: 100,
}

export default function TestsPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN', 'TEACHER')

  // Hierarchical navigation state
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)

  // Data state
  const [sessions, setSessions] = useState([])
  const [tests, setTests] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [subjects, setSubjects] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Search filter
  const [sessionSearch, setSessionSearch] = useState('')

  // Modals state
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION_FORM)

  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testForm, setTestForm] = useState(EMPTY_TEST_FORM)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    type: '', // 'SESSION' | 'TEST'
    id: null,
    name: '',
    loading: false,
  })

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [s, c, b, subj, t] = await Promise.all([
        listTestSessions(),
        listClasses({ page_size: 100 }),
        listBatches({ page_size: 100 }),
        listSubjects({ page_size: 100 }),
        listTests(),
      ])
      setSessions(Array.isArray(s) ? s : s?.items || [])
      setClasses(Array.isArray(c) ? c : c?.items || [])
      setBatches(Array.isArray(b) ? b : b?.items || [])
      setSubjects(Array.isArray(subj) ? subj : subj?.items || [])
      setTests(Array.isArray(t) ? t : t?.items || [])
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Keep selectedSession & selectedSubject fresh if data reloads
  useEffect(() => {
    if (selectedSession) {
      const fresh = sessions.find((s) => s.id === selectedSession.id)
      if (fresh) setSelectedSession(fresh)
    }
  }, [sessions, selectedSession])

  useEffect(() => {
    if (selectedSubject) {
      const fresh = subjects.find((s) => s.id === selectedSubject.id)
      if (fresh) setSelectedSubject(fresh)
    }
  }, [subjects, selectedSubject])

  // Tests for current session
  const sessionTests = useMemo(() => {
    if (!selectedSession) return []
    return tests.filter((t) => t.session_id === selectedSession.id)
  }, [tests, selectedSession])

  // Tests for current session & current subject
  const currentSubjectTests = useMemo(() => {
    if (!selectedSession || !selectedSubject) return []
    return tests.filter(
      (t) => t.session_id === selectedSession.id && t.subject_id === selectedSubject.id
    )
  }, [tests, selectedSession, selectedSubject])

  // Count tests per subject in selected session
  const subjectTestCounts = useMemo(() => {
    const map = {}
    sessionTests.forEach((t) => {
      map[t.subject_id] = (map[t.subject_id] || 0) + 1
    })
    return map
  }, [sessionTests])

  // Count total tests per session
  const sessionTestCounts = useMemo(() => {
    const map = {}
    tests.forEach((t) => {
      map[t.session_id] = (map[t.session_id] || 0) + 1
    })
    return map
  }, [tests])

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return sessions
    const q = sessionSearch.toLowerCase()
    return sessions.filter((s) => s.name.toLowerCase().includes(q))
  }, [sessions, sessionSearch])

  // Handlers for Session Creation
  async function handleCreateSession(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const newSession = await createTestSession({
        ...sessionForm,
        period_count: Number(sessionForm.period_count),
      })
      setSessionModalOpen(false)
      setSessionForm(EMPTY_SESSION_FORM)
      setSuccessMsg(`Session "${newSession.name}" created successfully.`)
      await loadAll()
      // Auto-enter the newly created session
      setSelectedSession(newSession)
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  // Handlers for Test Creation
  function openCreateTest() {
    if (!selectedSession || !selectedSubject) return
    const count = currentSubjectTests.length
    const suggestedName = `Test ${count + 1}`
    setTestForm({
      ...EMPTY_TEST_FORM,
      session_id: selectedSession.id,
      subject_id: selectedSubject.id,
      class_id: classes[0]?.id || '',
      batch_id: batches[0]?.id || '',
      name: suggestedName,
      test_date: new Date().toISOString().slice(0, 10),
      period_label: `Period 1`,
      total_marks: 100,
    })
    setFormError('')
    setTestModalOpen(true)
  }

  async function handleCreateTest(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const created = await createTest({
        ...testForm,
        session_id: Number(testForm.session_id),
        subject_id: Number(testForm.subject_id),
        class_id: Number(testForm.class_id),
        batch_id: Number(testForm.batch_id),
        total_marks: Number(testForm.total_marks),
      })
      setTestModalOpen(false)
      setSuccessMsg(`Test "${created.name}" created successfully.`)
      // Refresh tests
      const t = await listTests()
      setTests(Array.isArray(t) ? t : t?.items || [])
    } catch (err) {
      setFormError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  // Delete Handlers
  function confirmDeleteSession(session, e) {
    e.stopPropagation()
    setDeleteModal({
      open: true,
      type: 'SESSION',
      id: session.id,
      name: session.name,
      loading: false,
    })
  }

  function confirmDeleteTest(testItem, e) {
    e.stopPropagation()
    setDeleteModal({
      open: true,
      type: 'TEST',
      id: testItem.id,
      name: testItem.name,
      loading: false,
    })
  }

  async function handleDeleteConfirm() {
    setDeleteModal((prev) => ({ ...prev, loading: true }))
    try {
      if (deleteModal.type === 'SESSION') {
        await deleteTestSession(deleteModal.id)
        setSuccessMsg(`Session "${deleteModal.name}" deleted successfully.`)
        if (selectedSession?.id === deleteModal.id) {
          setSelectedSession(null)
          setSelectedSubject(null)
        }
      } else if (deleteModal.type === 'TEST') {
        await deleteTest(deleteModal.id)
        setSuccessMsg(`Test "${deleteModal.name}" deleted successfully.`)
      }
      setDeleteModal({ open: false, type: '', id: null, name: '', loading: false })
      await loadAll()
    } catch (err) {
      setError(normalizeError(err).message)
      setDeleteModal((prev) => ({ ...prev, loading: false }))
    }
  }

  const className = (id) => (classes || []).find((c) => c.id === id)?.name || '—'
  const batchName = (id) => (batches || []).find((b) => b.id === id)?.name || '—'

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="Tests & Sessions"
        subtitle="Manage academic test sessions, subject tracks, and tests"
        actions={
          canManage && (
            <div className="flex gap-2">
              {!selectedSession && (
                <button
                  onClick={() => setSessionModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <i className="fas fa-plus"></i>
                  New Session
                </button>
              )}
              {selectedSession && !selectedSubject && (
                <button
                  onClick={() => setSessionModalOpen(true)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <i className="fas fa-plus"></i>
                  New Session
                </button>
              )}
              {selectedSession && selectedSubject && (
                <button
                  onClick={openCreateTest}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <i className="fas fa-plus"></i>
                  Create Test
                </button>
              )}
            </div>
          )
        }
      />

      {/* Breadcrumb Navigation Bar */}
      <nav className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setSelectedSession(null)
            setSelectedSubject(null)
          }}
          className={`font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            !selectedSession
              ? 'text-indigo-600 pointer-events-none'
              : 'text-gray-500 hover:text-indigo-600'
          }`}
        >
          <i className="fas fa-folder-tree text-xs"></i>
          Test Sessions
        </button>

        {selectedSession && (
          <>
            <i className="fas fa-chevron-right text-gray-300 text-xs"></i>
            <button
              type="button"
              onClick={() => setSelectedSubject(null)}
              className={`font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                !selectedSubject
                  ? 'text-indigo-600 pointer-events-none'
                  : 'text-gray-500 hover:text-indigo-600'
              }`}
            >
              <i className="fas fa-layer-group text-xs text-indigo-500"></i>
              {selectedSession.name}
            </button>
          </>
        )}

        {selectedSubject && (
          <>
            <i className="fas fa-chevron-right text-gray-300 text-xs"></i>
            <span className="font-semibold text-indigo-600 flex items-center gap-1.5">
              <i className="fas fa-book-bookmark text-xs text-indigo-500"></i>
              {selectedSubject.name}
            </span>
          </>
        )}
      </nav>

      {error && <ErrorAlert message={error} onRetry={loadAll} />}

      {successMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2 font-medium">
            <i className="fas fa-circle-check text-green-600"></i>
            {successMsg}
          </span>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-green-600 hover:text-green-800 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 bg-white rounded-2xl border border-gray-200">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* ============================================================ */}
          {/* LEVEL 1: SESSIONS VIEW                                       */}
          {/* ============================================================ */}
          {!selectedSession && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                <div className="relative flex-1 max-w-md">
                  <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Search test sessions..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  Showing <strong>{filteredSessions.length}</strong> session{filteredSessions.length === 1 ? '' : 's'}
                </div>
              </div>

              {filteredSessions.length === 0 ? (
                <EmptyState
                  title="No test sessions yet"
                  subtitle="Create your first session (e.g. 'Pre-Test Session' or 'Midterm 2026') to start adding tests."
                  icon="fa-calendar-days"
                  action={
                    canManage && (
                      <button
                        onClick={() => setSessionModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-2 cursor-pointer mt-2"
                      >
                        <i className="fas fa-plus"></i>
                        New Session
                      </button>
                    )
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSessions.map((s) => {
                    const testCount = sessionTestCounts[s.id] || 0
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSession(s)}
                        className="group bg-white rounded-2xl border border-gray-200 hover:border-indigo-400 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs text-lg">
                              <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {s.is_active ? 'Active' : 'Inactive'}
                              </span>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={(e) => confirmDeleteSession(s, e)}
                                  title="Delete Session"
                                  className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <i className="fas fa-trash-can text-sm"></i>
                                </button>
                              )}
                            </div>
                          </div>

                          <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                            {s.name}
                          </h3>

                          <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                            <div className="flex items-center gap-2">
                              <i className="far fa-calendar text-gray-400 w-3.5"></i>
                              <span>
                                {s.start_date} → {s.end_date}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <i className="far fa-clock text-gray-400 w-3.5"></i>
                              <span>{s.period_count} Evaluation Periods</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                            <i className="fas fa-file-pen text-indigo-500 mr-1.5"></i>
                            {testCount} Test{testCount === 1 ? '' : 's'}
                          </span>
                          <span className="font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            Enter Session
                            <i className="fas fa-arrow-right text-[10px]"></i>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* LEVEL 2: SUBJECTS VIEW INSIDE SELECTED SESSION               */}
          {/* ============================================================ */}
          {selectedSession && !selectedSubject && (
            <div className="space-y-4">
              {/* Session Overview Banner */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-indigo-200 bg-indigo-800/80 px-2.5 py-0.5 rounded-full border border-indigo-700">
                      Selected Session
                    </span>
                    <span className="text-xs text-indigo-200">
                      {selectedSession.start_date} to {selectedSession.end_date}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">{selectedSession.name}</h2>
                  <p className="text-xs text-indigo-200/90 mt-1">
                    Select a subject below to manage its tests (Test 1, Test 2, Test 3...) or enter test marks.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
                    <span className="text-[11px] text-indigo-200 uppercase font-semibold block">Total Tests</span>
                    <span className="text-xl font-bold text-white mt-0.5 block">{sessionTests.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSession(null)}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-3 rounded-xl border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-arrow-left"></i>
                    All Sessions
                  </button>
                </div>
              </div>

              {/* Subjects List Heading */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Subjects in {selectedSession.name}</h3>
                  <p className="text-xs text-gray-500">
                    Click on any subject to create or view tests (e.g., Chemistry $\rightarrow$ Test 1, Test 2...)
                  </p>
                </div>
              </div>

              {subjects.length === 0 ? (
                <EmptyState
                  title="No subjects available"
                  subtitle="Please add subjects in the Subjects management module first."
                  icon="fa-book"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subjects.map((subj) => {
                    const count = subjectTestCounts[subj.id] || 0
                    return (
                      <div
                        key={subj.id}
                        onClick={() => setSelectedSubject(subj)}
                        className="group bg-white rounded-2xl border border-gray-200 hover:border-indigo-400 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs text-lg">
                              <i className="fas fa-flask"></i>
                            </div>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                count > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {count} {count === 1 ? 'Test' : 'Tests'}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                            {subj.name}
                          </h4>
                          <p className="text-xs text-gray-400">
                            {count > 0 ? `${count} test${count === 1 ? '' : 's'} recorded` : 'No tests created yet'}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-gray-100 mt-4 flex items-center justify-between text-xs">
                          <span className="font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            Manage Tests
                            <i className="fas fa-arrow-right text-[10px]"></i>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* LEVEL 3: TESTS VIEW INSIDE SELECTED SUBJECT & SESSION        */}
          {/* ============================================================ */}
          {selectedSession && selectedSubject && (
            <div className="space-y-4">
              {/* Context Header */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shadow-xs">
                    <i className="fas fa-file-lines"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {selectedSession.name}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-semibold text-gray-700">{selectedSubject.name}</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedSubject.name} Tests ({currentSubjectTests.length})
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSubject(null)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-arrow-left"></i>
                    Back to Subjects
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={openCreateTest}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <i className="fas fa-plus"></i>
                      Create Next Test ({`Test ${currentSubjectTests.length + 1}`})
                    </button>
                  )}
                </div>
              </div>

              {/* Tests Table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
                {currentSubjectTests.length === 0 ? (
                  <EmptyState
                    title={`No tests for ${selectedSubject.name} yet`}
                    subtitle={`Click "+ Create Next Test" to create "Test 1" for ${selectedSubject.name}.`}
                    icon="fa-file-circle-plus"
                    action={
                      canManage && (
                        <button
                          type="button"
                          onClick={openCreateTest}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-2 cursor-pointer mt-2"
                        >
                          <i className="fas fa-plus"></i>
                          Create Test 1
                        </button>
                      )
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50/80 text-gray-500 text-left border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Test Name</th>
                          <th className="px-5 py-3 font-semibold">Class & Batch</th>
                          <th className="px-5 py-3 font-semibold">Period</th>
                          <th className="px-5 py-3 font-semibold">Test Date</th>
                          <th className="px-5 py-3 font-semibold">Total Marks</th>
                          <th className="px-5 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {currentSubjectTests.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-gray-900 flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-mono text-xs font-bold">
                                {t.name.replace(/[^0-9]/g, '') || '#'}
                              </span>
                              {t.name}
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">
                              <span className="font-medium text-gray-800">{className(t.class_id)}</span>
                              <span className="text-gray-400 mx-1.5">/</span>
                              <span className="text-gray-600">{batchName(t.batch_id)}</span>
                            </td>
                            <td className="px-5 py-3.5 text-gray-600">{t.period_label || '—'}</td>
                            <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{t.test_date}</td>
                            <td className="px-5 py-3.5 text-gray-900 font-semibold">{t.total_marks}</td>
                            <td className="px-5 py-3.5 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/marks?session_id=${t.session_id}&test_id=${t.id}`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <i className="fas fa-list-ol text-[11px]"></i>
                                Enter Marks
                              </button>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={(e) => confirmDeleteTest(t, e)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                                  title="Delete Test"
                                >
                                  <i className="fas fa-trash-can text-sm"></i>
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE TEST SESSION                                   */}
      {/* ============================================================ */}
      <Modal open={sessionModalOpen} title="New Test Session" onClose={() => setSessionModalOpen(false)}>
        <form onSubmit={handleCreateSession} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Name</label>
            <input
              required
              value={sessionForm.name}
              onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
              placeholder="e.g. Pre-Test Session, Term 1 2026"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                required
                type="date"
                value={sessionForm.start_date}
                onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                required
                type="date"
                value={sessionForm.end_date}
                onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Evaluation Periods</label>
            <input
              required
              type="number"
              min="1"
              max="24"
              value={sessionForm.period_count}
              onChange={(e) => setSessionForm({ ...sessionForm, period_count: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setSessionModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: CREATE TEST                                           */}
      {/* ============================================================ */}
      <Modal open={testModalOpen} title="Create Test" onClose={() => setTestModalOpen(false)} width="max-w-lg">
        <form onSubmit={handleCreateTest} className="space-y-4">
          {formError && <ErrorAlert message={formError} />}

          {/* Context Banner */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-950">
              Session: <strong className="text-indigo-700">{selectedSession?.name}</strong>
            </span>
            <span className="font-semibold text-indigo-950">
              Subject: <strong className="text-indigo-700">{selectedSubject?.name}</strong>
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Name <span className="text-gray-400 font-normal">(auto-incremented)</span>
            </label>
            <input
              required
              value={testForm.name}
              onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900"
              placeholder="e.g. Test 1, Test 2, Chapter 3 Test"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select
                required
                value={testForm.class_id}
                onChange={(e) => setTestForm({ ...testForm, class_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select class</option>
                {(classes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
              <select
                required
                value={testForm.batch_id}
                onChange={(e) => setTestForm({ ...testForm, batch_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select batch</option>
                {(batches || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
              <input
                required
                type="date"
                value={testForm.test_date}
                onChange={(e) => setTestForm({ ...testForm, test_date: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
              <input
                required
                type="number"
                min="1"
                step="0.5"
                value={testForm.total_marks}
                onChange={(e) => setTestForm({ ...testForm, total_marks: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Period Label</label>
            <input
              required
              value={testForm.period_label}
              onChange={(e) => setTestForm({ ...testForm, period_label: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Period 1, Month 1, Term 1"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Creating...' : 'Create Test'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* CONFIRM DELETE MODAL                                         */}
      {/* ============================================================ */}
      <ConfirmDeleteModal
        open={deleteModal.open}
        title={deleteModal.type === 'SESSION' ? 'Delete Test Session' : 'Delete Test'}
        itemName={deleteModal.name}
        message={
          deleteModal.type === 'SESSION'
            ? 'Are you sure you want to delete this test session? All tests and student marks under this session will be permanently deleted.'
            : 'Are you sure you want to delete this test? All student marks associated with this test will also be deleted.'
        }
        loading={deleteModal.loading}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteModal({ open: false, type: '', id: null, name: '', loading: false })}
      />
    </div>
  )
}
