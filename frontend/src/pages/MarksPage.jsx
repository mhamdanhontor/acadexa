import { useEffect, useMemo, useState } from 'react'
import { listTestSessions, listTests, listMarks, saveBulkMarks } from '../api/academics'
import { listStudents } from '../api/students'
import { normalizeError } from '../api/client'
import { useUnsavedChangesWarning, confirmLeaveIfUnsaved } from '../hooks/useUnsavedChangesWarning'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'

export default function MarksPage() {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [tests, setTests] = useState([])
  const [testId, setTestId] = useState('')
  const [selectedTest, setSelectedTest] = useState(null)

  const [students, setStudents] = useState([])
  const [marksMap, setMarksMap] = useState({}) // student_id -> obtained_marks (string)
  const [savedMarksMap, setSavedMarksMap] = useState({})
  const [rowErrors, setRowErrors] = useState({})

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(marksMap) !== JSON.stringify(savedMarksMap),
    [marksMap, savedMarksMap]
  )
  useUnsavedChangesWarning(hasUnsavedChanges)

  useEffect(() => {
    listTestSessions()
      .then((s) => setSessions(Array.isArray(s) ? s : (s?.items || [])))
      .catch((err) => setError(normalizeError(err).message))
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setTests([])
      return
    }
    listTests({ session_id: sessionId })
      .then((t) => setTests(Array.isArray(t) ? t : (t?.items || [])))
      .catch((err) => setError(normalizeError(err).message))
  }, [sessionId])

  async function loadRoster() {
    if (!testId) return
    if (hasUnsavedChanges && !confirmLeaveIfUnsaved(true)) return

    setLoading(true)
    setError(null)
    setSuccessMsg('')
    try {
      const test = (tests || []).find((t) => t.id === Number(testId))
      if (!test) {
        setLoading(false)
        return
      }
      setSelectedTest(test)

      const [studentData, existingMarks] = await Promise.all([
        listStudents({ class_id: test.class_id, batch_id: test.batch_id, is_active: true, page_size: 200 }),
        listMarks({ test_id: testId, page_size: 200 }),
      ])
      const sItems = Array.isArray(studentData) ? studentData : (studentData?.items || [])
      const mItems = Array.isArray(existingMarks) ? existingMarks : (existingMarks?.items || [])
      setStudents(sItems)

      const map = {}
      sItems.forEach((s) => {
        map[s.id] = ''
      })
      mItems.forEach((m) => {
        map[m.student_id] = String(m.obtained_marks)
      })
      setMarksMap(map)
      setSavedMarksMap(map)
      setRowErrors({})
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  function setMark(studentId, value) {
    setMarksMap((prev) => ({ ...prev, [studentId]: value }))

    const num = Number(value)
    const errors = { ...rowErrors }
    if (value === '') {
      delete errors[studentId]
    } else if (Number.isNaN(num) || num < 0 || num > selectedTest.total_marks) {
      errors[studentId] = `Must be between 0 and ${selectedTest.total_marks}`
    } else {
      delete errors[studentId]
    }
    setRowErrors(errors)
  }

  async function handleSave() {
    if (Object.keys(rowErrors).length > 0) {
      setError('Fix invalid marks (highlighted in red) before saving.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccessMsg('')
    try {
      const records = students
        .filter((s) => marksMap[s.id] !== '' && marksMap[s.id] !== undefined)
        .map((s) => ({ student_id: s.id, obtained_marks: Number(marksMap[s.id]) }))

      if (records.length === 0) {
        setError('Enter at least one mark before saving.')
        setSaving(false)
        return
      }

      const result = await saveBulkMarks({ test_id: Number(testId), records })
      setSavedMarksMap(marksMap)
      setSuccessMsg(
        `Saved marks for ${result.students_updated} student(s). Notifications queued: ${result.notifications_queued}.`
      )
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  function grade(obtained) {
    if (obtained === '' || obtained === undefined || !selectedTest) return '—'
    const pct = (Number(obtained) / selectedTest.total_marks) * 100
    if (Number.isNaN(pct)) return '—'
    if (pct >= 90) return 'A+'
    if (pct >= 75) return 'A'
    if (pct >= 60) return 'B'
    if (pct >= 40) return 'C'
    if (pct >= 33) return 'D'
    return 'F'
  }

  return (
    <div>
      <PageHeader title="Marks" subtitle="Enter and manage test marks" />

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Test Session</label>
          <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setTestId('') }} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select session</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Test</label>
          <select value={testId} onChange={(e) => setTestId(e.target.value)} disabled={!sessionId} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100">
            <option value="">Select test</option>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.period_label})</option>)}
          </select>
        </div>
        {selectedTest && (
          <div className="text-sm text-gray-500">
            Total Marks: <span className="font-semibold text-gray-800">{selectedTest.total_marks}</span>
          </div>
        )}
      </div>

      {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
      {successMsg && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
          <i className="fas fa-circle-check mr-2"></i>{successMsg}
        </div>
      )}

      {!testId ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState title="Select a test" subtitle="Choose a test session and test to enter marks." icon="fa-list-ol" />
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState title="No active students for this class/batch" icon="fa-user-graduate" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Student ID</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Obtained Marks</th>
                  <th className="px-5 py-3 font-medium">Percentage</th>
                  <th className="px-5 py-3 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => {
                  const value = marksMap[s.id] ?? ''
                  const pct = value !== '' && selectedTest ? ((Number(value) / selectedTest.total_marks) * 100).toFixed(1) : '—'
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 text-gray-600">{s.student_code}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          min="0"
                          max={selectedTest?.total_marks}
                          step="0.5"
                          value={value}
                          onChange={(e) => setMark(s.id, e.target.value)}
                          className={`w-24 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                            rowErrors[s.id] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
                          }`}
                        />
                        {rowErrors[s.id] && <p className="text-xs text-red-600 mt-1">{rowErrors[s.id]}</p>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{pct === '—' ? '—' : `${pct}%`}</td>
                      <td className="px-5 py-3 text-gray-600">{grade(value)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-md text-sm flex items-center gap-2"
            >
              {saving && <Spinner size="sm" />}
              {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Marks' : 'Saved'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
