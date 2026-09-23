import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listTestSessions, listTests, listMarks, saveBulkMarks, getMarksNotifications } from '../api/academics'
import { listSubjects } from '../api/academicStructure'
import { listStudents } from '../api/students'
import { normalizeError } from '../api/client'
import { useUnsavedChangesWarning, confirmLeaveIfUnsaved } from '../hooks/useUnsavedChangesWarning'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import MarksDispatchModal from '../components/MarksDispatchModal'

export default function MarksPage() {
  const [searchParams] = useSearchParams()
  const initialSessionId = searchParams.get('session_id') || ''
  const initialTestId = searchParams.get('test_id') || ''

  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [tests, setTests] = useState([])
  const [testId, setTestId] = useState(initialTestId)
  const [selectedTest, setSelectedTest] = useState(null)

  const [students, setStudents] = useState([])
  const [marksMap, setMarksMap] = useState({}) // student_id -> obtained_marks (string)
  const [savedMarksMap, setSavedMarksMap] = useState({})
  const [rowErrors, setRowErrors] = useState({})

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [autoSendFirst, setAutoSendFirst] = useState(false)
  const [dispatches, setDispatches] = useState([])

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(marksMap) !== JSON.stringify(savedMarksMap),
    [marksMap, savedMarksMap]
  )
  useUnsavedChangesWarning(hasUnsavedChanges)

  useEffect(() => {
    Promise.all([listTestSessions(), listSubjects({ page_size: 100 })])
      .then(([s, subj]) => {
        setSessions(Array.isArray(s) ? s : s?.items || [])
        setSubjects(Array.isArray(subj) ? subj : subj?.items || [])
      })
      .catch((err) => setError(normalizeError(err).message))
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setTests([])
      setTestId('')
      setSelectedTest(null)
      return
    }
    const params = { session_id: sessionId }
    if (subjectId) params.subject_id = subjectId
    listTests(params)
      .then((t) => {
        const items = Array.isArray(t) ? t : t?.items || []
        setTests(items)
        if (initialTestId && items.some((item) => String(item.id) === String(initialTestId))) {
          const match = items.find((item) => String(item.id) === String(initialTestId))
          if (match && !subjectId) {
            setSubjectId(String(match.subject_id))
          }
        }
      })
      .catch((err) => setError(normalizeError(err).message))
  }, [sessionId, subjectId, initialTestId])

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
        listStudents({ class_id: test.class_id, is_active: true, page_size: 200 }),
        listMarks({ test_id: testId, page_size: 200 }),
      ])
      const rawStudents = Array.isArray(studentData) ? studentData : (studentData?.items || [])
      // Sort in ascending order of Student ID (natural numeric sorting)
      const sItems = [...rawStudents].sort((a, b) =>
        (a.student_code || '').localeCompare(b.student_code || '', undefined, { numeric: true }) || (a.id - b.id)
      )
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

  function buildLocalMarksDispatches() {
    const academyName = 'Honor Knowledge Academy'
    const items = []
    const sub = selectedTest?.subject?.name || selectedTest?.name || 'General'
    const tName = selectedTest?.name || 'Class Test'
    const tot = selectedTest?.total_marks || 100

    students.forEach((s) => {
      const val = marksMap[s.id]
      if (val === '' || val === undefined) return
      const obt = Number(val)
      const pct = tot > 0 ? ((obt / tot) * 100).toFixed(1) : '0.0'
      const g = grade(val)
      const guardian = s.guardian_name || 'Guardian'

      const msg = (
        `*TEST RESULT ANNOUNCEMENT*\n*Assalam-o-Alaikum*\n\n` +
        `Dear Parent/Guardian (*${guardian}*),\n\n` +
        `Test Result Announcement for *${s.name}*:\n\n` +
        `📚 *Subject:* ${sub}\n` +
        `📝 *Test:* ${tName}\n` +
        `🎯 *Score:* ${obt}/${tot} (${pct}%)\n\n` +
        `Keep encouraging your child's academic journey!\n\n` +
        `Best regards,\n` +
        `*${academyName}*\n\n` +
        `-----------------------------------\n\n` +
        `*امتحانی نتیجہ کی اطلاع*\n*السلام علیکم*\n\n` +
        `محترم والدین / سرپرست (*${guardian}*)،\n\n` +
        `${s.name} کے امتحانی نتیجے کی تفصیل درج ذیل ہے:\n\n` +
        `📚 *مضمون:* ${sub}\n` +
        `📝 *ٹیسٹ:* ${tName}\n` +
        `🎯 *حاصل کردہ نمبر:* ${obt}/${tot} (${pct}%)\n\n` +
        `اپنے بچے کی تعلیمی لگن اور محنت کی حوصلہ افزائی جاری رکھیں۔\n\n` +
        `والسلام،\n` +
        `*${academyName}*`
      )

      items.push({
        student_id: s.id,
        student_name: s.name,
        student_code: s.student_code,
        guardian_name: guardian,
        whatsapp_number: s.whatsapp_number,
        obtained_marks: obt,
        total_marks: tot,
        percentage: Number(pct),
        grade: g,
        message: msg,
        status: 'PENDING',
      })
    })
    return items
  }

  async function loadAndOpenWhatsAppModal() {
    if (!testId) return
    try {
      const data = await getMarksNotifications({ test_id: Number(testId) })
      if (Array.isArray(data) && data.length > 0) {
        setDispatches(data)
      } else {
        setDispatches(buildLocalMarksDispatches())
      }
    } catch {
      setDispatches(buildLocalMarksDispatches())
    } finally {
      setAutoSendFirst(false)
      setWhatsappModalOpen(true)
    }
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

      const dispatchItems =
        Array.isArray(result.dispatches) && result.dispatches.length > 0
          ? result.dispatches
          : buildLocalMarksDispatches()

      setDispatches(dispatchItems)
      setAutoSendFirst(true)
      setWhatsappModalOpen(true)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const filledMarksCount = useMemo(() => {
    return Object.values(marksMap).filter((v) => v !== '' && v !== undefined).length
  }, [marksMap])

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
          <select
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value)
              setSubjectId('')
              setTestId('')
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setTestId('')
            }}
            disabled={!sessionId}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Subjects</option>
            {subjects.map((subj) => (
              <option key={subj.id} value={subj.id}>
                {subj.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Test</label>
          <select
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            disabled={!sessionId || tests.length === 0}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">
              {!sessionId
                ? 'Select session first'
                : tests.length === 0
                ? 'No tests found'
                : 'Select test'}
            </option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.test_date})
              </option>
            ))}
          </select>
        </div>

        {selectedTest && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-3">
            <span>
              Total Marks: <strong className="text-gray-900">{selectedTest.total_marks}</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span>
              Syllabus: <strong className="text-gray-900">{selectedTest.period_label || '—'}</strong>
            </span>
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
          {filledMarksCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 text-lg shadow-xs">
                  <i className="fab fa-whatsapp"></i>
                </div>
                <div>
                  <span className="text-sm font-semibold text-emerald-950">
                    {filledMarksCount} student{filledMarksCount > 1 ? 's' : ''} with marks entered
                  </span>
                  <p className="text-xs text-emerald-800">
                    Send WhatsApp result alerts directly to parents from your Admin WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadAndOpenWhatsAppModal}
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
              >
                <i className="fab fa-whatsapp text-sm"></i>
                Send WhatsApp Marks ({filledMarksCount})
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Student ID</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Batch</th>
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
                      <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-700">{s.student_code}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium border border-gray-200">
                          {s.batch?.name || '—'}
                        </span>
                      </td>
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

      <MarksDispatchModal
        open={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        dispatches={dispatches}
        testName={selectedTest?.name || 'Class Test'}
        subject={selectedTest?.subject?.name || ''}
        autoSendFirst={autoSendFirst}
      />
    </div>
  )
}

