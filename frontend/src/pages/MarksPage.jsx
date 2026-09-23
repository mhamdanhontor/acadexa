import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listTestSessions, listTests, listMarks, saveBulkMarks, updateTest, getTest } from '../api/academics'
import { listSubjects, listClasses, listBatches } from '../api/academicStructure'
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
  const paramSessionId = searchParams.get('session_id') || ''
  const paramSubjectId = searchParams.get('subject_id') || ''
  const paramTestId = searchParams.get('test_id') || ''

  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(paramSessionId)
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState(paramSubjectId)
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [tests, setTests] = useState([])
  const [testId, setTestId] = useState(paramTestId)
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

  // React to URL search param changes
  useEffect(() => {
    const sId = searchParams.get('session_id') || ''
    const subId = searchParams.get('subject_id') || ''
    const tId = searchParams.get('test_id') || ''
    if (sId && sId !== sessionId) setSessionId(sId)
    if (subId && subId !== subjectId) setSubjectId(subId)
    if (tId && tId !== testId) {
      setTestId(tId)
      loadRoster(tId)
    }
  }, [searchParams])

  useEffect(() => {
    Promise.all([
      listTestSessions(),
      listSubjects({ page_size: 100 }),
      listClasses().catch(() => []),
      listBatches().catch(() => []),
    ])
      .then(([s, subj, cls, btc]) => {
        setSessions(Array.isArray(s) ? s : s?.items || [])
        setSubjects(Array.isArray(subj) ? subj : subj?.items || [])
        setClasses(Array.isArray(cls) ? cls : cls?.items || [])
        setBatches(Array.isArray(btc) ? btc : btc?.items || [])
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
        if (testId) {
          const match = items.find((item) => String(item.id) === String(testId))
          if (match) {
            setSelectedTest(match)
          }
        }
      })
      .catch((err) => setError(normalizeError(err).message))
  }, [sessionId, subjectId])

  async function loadRoster(targetTestId = testId, testList = tests) {
    const activeTestId = targetTestId || testId
    if (!activeTestId) return
    if (hasUnsavedChanges && !confirmLeaveIfUnsaved(true)) return

    setLoading(true)
    setError(null)
    setSuccessMsg('')
    try {
      // Find in testList or fetch directly from backend API
      let test = (testList || []).find((t) => String(t.id) === String(activeTestId))
      if (!test && activeTestId) {
        try {
          test = await getTest(activeTestId)
        } catch {
          test = null
        }
      }
      if (!test) {
        setLoading(false)
        return
      }
      setSelectedTest(test)
      if (test.session_id && (!sessionId || String(sessionId) !== String(test.session_id))) {
        setSessionId(String(test.session_id))
      }
      if (test.subject_id && (!subjectId || String(subjectId) !== String(test.subject_id))) {
        setSubjectId(String(test.subject_id))
      }

      // Multi-tier resilient student roster retrieval:
      let rawStudents = []

      // Tier 1: If test has both class_id and batch_id, query specifically for that class & batch
      if (test.class_id && test.batch_id) {
        try {
          const res = await listStudents({ class_id: test.class_id, batch_id: test.batch_id, is_active: true, page_size: 200 })
          rawStudents = Array.isArray(res) ? res : (res?.items || [])
        } catch {
          rawStudents = []
        }
      }

      // Tier 2: If test has class_id (or Tier 1 was empty), query all students of this class across all batches
      if (rawStudents.length === 0 && test.class_id) {
        try {
          const res = await listStudents({ class_id: test.class_id, is_active: true, page_size: 200 })
          rawStudents = Array.isArray(res) ? res : (res?.items || [])
        } catch {
          rawStudents = []
        }
      }

      // Tier 3: If test has batch_id and no students found yet, query all students of this batch
      if (rawStudents.length === 0 && test.batch_id) {
        try {
          const res = await listStudents({ batch_id: test.batch_id, is_active: true, page_size: 200 })
          rawStudents = Array.isArray(res) ? res : (res?.items || [])
        } catch {
          rawStudents = []
        }
      }

      // Tier 4: If parent session has a class_id, query students of the session's class
      const parentSession = (sessions || []).find((s) => String(s.id) === String(sessionId))
      if (rawStudents.length === 0 && parentSession?.class_id) {
        try {
          const res = await listStudents({ class_id: parentSession.class_id, is_active: true, page_size: 200 })
          rawStudents = Array.isArray(res) ? res : (res?.items || [])
        } catch {
          rawStudents = []
        }
      }

      // Tier 5: Ultimate fallback to all active students so the teacher is NEVER locked out
      if (rawStudents.length === 0) {
        try {
          const res = await listStudents({ is_active: true, page_size: 200 })
          rawStudents = Array.isArray(res) ? res : (res?.items || [])
        } catch {
          rawStudents = []
        }
      }

      const existingMarks = await listMarks({ test_id: activeTestId, page_size: 200 }).catch(() => [])

      // Sort in ascending order of Student ID (natural numeric sorting: e.g. HKA-0001, HKA-0002)
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

  async function handleChangeTestClass(newClassId) {
    if (!selectedTest || !newClassId) return
    setLoading(true)
    setError(null)
    setSuccessMsg('')
    try {
      const updated = await updateTest(selectedTest.id, { class_id: Number(newClassId) })
      setSelectedTest(updated)
      setTests((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      const className = classes.find((c) => c.id === Number(newClassId))?.name || newClassId
      setSuccessMsg(`Test assigned to class "${className}".`)
      // Refresh students for newly assigned class
      const res = await listStudents({ class_id: Number(newClassId), is_active: true, page_size: 200 })
      const sData = Array.isArray(res) ? res : (res?.items || [])
      const sItems = [...sData].sort((a, b) =>
        (a.student_code || '').localeCompare(b.student_code || '', undefined, { numeric: true }) || (a.id - b.id)
      )
      setStudents(sItems)
      const existingMarks = await listMarks({ test_id: selectedTest.id, page_size: 200 }).catch(() => [])
      const mItems = Array.isArray(existingMarks) ? existingMarks : (existingMarks?.items || [])
      const map = {}
      sItems.forEach((s) => { map[s.id] = '' })
      mItems.forEach((m) => { map[m.student_id] = String(m.obtained_marks) })
      setMarksMap(map)
      setSavedMarksMap(map)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (testId) {
      loadRoster(testId, tests)
    }
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
            disabled={!sessionId && !testId && tests.length === 0}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">
              {!sessionId && !testId
                ? 'Select session first'
                : tests.length === 0 && !selectedTest
                ? 'No tests found'
                : 'Select test'}
            </option>
            {selectedTest && !tests.some((t) => String(t.id) === String(selectedTest.id)) && (
              <option value={selectedTest.id}>
                {selectedTest.name} ({selectedTest.test_date})
              </option>
            )}
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.test_date})
              </option>
            ))}
          </select>
        </div>

        {selectedTest && (
          <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-gray-800">
              <i className="fas fa-chalkboard-user text-indigo-500"></i>
              Class: <strong>{classes.find((c) => c.id === selectedTest.class_id)?.name || 'All Classes'}</strong>
              {selectedTest.batch_id ? ` / ${batches.find((b) => b.id === selectedTest.batch_id)?.name || 'Batch'}` : ' (All Batches)'}
            </span>
            <span className="text-gray-300">|</span>
            <span>
              Total Marks: <strong className="text-gray-900">{selectedTest.total_marks}</strong>
            </span>
            <span className="text-gray-300">|</span>
            <span>
              Syllabus: <strong className="text-gray-900">{selectedTest.period_label || '—'}</strong>
            </span>
            {classes.length > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500">Change Class:</span>
                  <select
                    value={selectedTest.class_id || ''}
                    onChange={(e) => handleChangeTestClass(e.target.value)}
                    className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-indigo-700 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    title="Change target class for this test"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <EmptyState
            title="No active students found"
            subtitle="No active students matched this class or batch. You can change the test's class using the dropdown above or check enrolled students in the Students tab."
            icon="fa-user-graduate"
          />
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
                  <th className="px-5 py-3 font-medium">Class & Batch</th>
                  <th className="px-5 py-3 font-medium">Guardian & WhatsApp</th>
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
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-indigo-700">{s.student_code}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium border border-indigo-100 mr-1.5">
                          {s.class_room?.name || classes.find((c) => c.id === s.class_id)?.name || 'Class'}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium border border-gray-200">
                          {s.batch?.name || batches.find((b) => b.id === s.batch_id)?.name || 'All Batches'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs">
                        <span className="text-gray-900 font-medium">{s.guardian_name || 'Guardian'}</span>
                        {s.whatsapp_number && (
                          <span className="text-emerald-700 block text-[11px] font-mono mt-0.5">
                            <i className="fab fa-whatsapp mr-1 text-emerald-600"></i>
                            {s.whatsapp_number}
                          </span>
                        )}
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
                      <td className="px-5 py-3 text-gray-600 font-medium">{pct === '—' ? '—' : `${pct}%`}</td>
                      <td className="px-5 py-3 text-gray-600 font-semibold">{grade(value)}</td>
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

