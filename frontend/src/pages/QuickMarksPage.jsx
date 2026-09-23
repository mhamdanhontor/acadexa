import { useEffect, useMemo, useRef, useState } from 'react'
import { listStudents } from '../api/students'
import { saveQuickMarks } from '../api/academics'
import { normalizeError } from '../api/client'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import QuickMarksDispatchModal from '../components/QuickMarksDispatchModal'

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function computeGrade(percentage) {
  if (percentage >= 90) return 'A+'
  if (percentage >= 80) return 'A'
  if (percentage >= 70) return 'B'
  if (percentage >= 60) return 'C'
  if (percentage >= 50) return 'D'
  return 'F'
}

export default function QuickMarksPage() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // Top test configuration
  const [testName, setTestName] = useState('Weekly Test')
  const [subject, setSubject] = useState('General')
  const [defaultTotalMarks, setDefaultTotalMarks] = useState(50)
  const [testDate, setTestDate] = useState(todayISO())

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'filled' | 'empty'

  // Row marks data: student_id -> { obtained: string, total: number }
  const [marksData, setMarksData] = useState({})

  // Dispatch modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false)
  const [dispatches, setDispatches] = useState([])

  // Store refs to input fields for rapid keyboard down-arrow navigation
  const inputRefs = useRef({})

  async function loadAllStudents() {
    setLoading(true)
    setError(null)
    try {
      // Fetch active students across all classes and batches
      const data = await listStudents({ page_size: 200, is_active: true })
      const rawItems = Array.isArray(data) ? data : data?.items || []
      const items = [...rawItems].sort((a, b) =>
        (a.student_code || '').localeCompare(b.student_code || '', undefined, { numeric: true }) || (a.id - b.id)
      )
      setStudents(items)

      // Initialize marksData with default total marks
      const initial = {}
      items.forEach((s) => {
        initial[s.id] = { obtained: '', total: defaultTotalMarks }
      })
      setMarksData(initial)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When defaultTotalMarks changes, update rows that haven't been customized
  function handleDefaultTotalChange(newTotal) {
    const val = Number(newTotal) || 1
    setDefaultTotalMarks(val)
    setMarksData((prev) => {
      const updated = { ...prev }
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], total: val }
      })
      return updated
    })
  }

  function handleObtainedChange(studentId, value) {
    setMarksData((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { total: defaultTotalMarks }),
        obtained: value,
      },
    }))
  }

  function handleRowTotalChange(studentId, value) {
    const val = Number(value) || 1
    setMarksData((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { obtained: '' }),
        total: val,
      },
    }))
  }

  function clearRow(studentId) {
    setMarksData((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), obtained: '' },
    }))
  }

  function resetAll() {
    if (!window.confirm('Clear all entered marks?')) return
    setMarksData((prev) => {
      const cleared = {}
      Object.keys(prev).forEach((id) => {
        cleared[id] = { obtained: '', total: defaultTotalMarks }
      })
      return cleared
    })
    setSuccessMsg('')
  }

  // Filter students based on search query and filled/empty mode
  const filteredStudents = useMemo(() => {
    let list = students

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.student_code && s.student_code.toLowerCase().includes(q)) ||
          (s.guardian_name && s.guardian_name.toLowerCase().includes(q)) ||
          (s.whatsapp_number && s.whatsapp_number.includes(q))
      )
    }

    if (filterMode === 'filled') {
      list = list.filter((s) => marksData[s.id]?.obtained !== '' && marksData[s.id]?.obtained !== undefined)
    } else if (filterMode === 'empty') {
      list = list.filter((s) => !marksData[s.id]?.obtained && marksData[s.id]?.obtained !== 0)
    }

    return list
  }, [students, searchQuery, filterMode, marksData])

  // Count filled rows
  const filledStudents = useMemo(() => {
    return students.filter(
      (s) => marksData[s.id]?.obtained !== '' && marksData[s.id]?.obtained !== undefined
    )
  }, [students, marksData])

  // Average percentage of filled
  const avgPercentage = useMemo(() => {
    if (filledStudents.length === 0) return 0
    const sum = filledStudents.reduce((acc, s) => {
      const entry = marksData[s.id]
      const obt = Number(entry.obtained) || 0
      const tot = Number(entry.total) || 1
      return acc + (obt / tot) * 100
    }, 0)
    return Math.round(sum / filledStudents.length)
  }, [filledStudents, marksData])

  function buildLocalDispatches(studentList) {
    const academyName = 'Honor Knowledge Academy'
    const tName = testName || 'Class Test'
    const sub = subject || 'General'

    return studentList.map((s) => {
      const entry = marksData[s.id] || {}
      const obt = Number(entry.obtained) || 0
      const tot = Number(entry.total) || 100
      const pct = ((obt / tot) * 100).toFixed(1)
      let g = 'F'
      if (pct >= 90) g = 'A+'
      else if (pct >= 75) g = 'A'
      else if (pct >= 60) g = 'B'
      else if (pct >= 40) g = 'C'
      else if (pct >= 33) g = 'D'

      const guardian = s.guardian_name || 'Guardian'
      const msg = (
        `*TEST RESULT ANNOUNCEMENT*\n*Assalam-o-Alaikum*\n\n` +
        `Dear Parent/Guardian (*${guardian}*),\n\n` +
        `Test Result Announcement for *${s.name}*:\n\n` +
        `📚 *Subject:* ${sub}\n` +
        `📝 *Test:* ${tName}\n` +
        `🎯 *Score:* ${obt}/${tot} (${pct}%)\n` +
        `🏆 *Grade:* ${g}\n\n` +
        `Keep encouraging your child's academic journey!\n\n` +
        `Best regards,\n*${academyName}*`
      )
      const cleanPhone = (s.whatsapp_number || '').replace(/[^0-9]/g, '')
      const encodedMsg = encodeURIComponent(msg)

      return {
        notification_id: `local_${s.id}_${Date.now()}`,
        student_id: s.id,
        student_name: s.name,
        student_code: s.student_code || '',
        guardian_name: guardian,
        whatsapp_number: s.whatsapp_number || '',
        obtained_marks: obt,
        total_marks: tot,
        percentage: Number(pct),
        grade: g,
        message: msg,
        whatsapp_web_url: cleanPhone ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}` : '',
        whatsapp_app_url: cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${encodedMsg}` : '',
        status: 'PENDING',
      }
    })
  }

  // Save and open dispatch for single student
  async function handleSendSingle(student) {
    const entry = marksData[student.id]
    if (!entry || entry.obtained === '' || entry.obtained === undefined) {
      alert(`Please enter obtained marks for ${student.name} first.`)
      return
    }

    const obt = Number(entry.obtained)
    const tot = Number(entry.total)

    if (obt < 0 || obt > tot) {
      alert(`Obtained marks (${obt}) must be between 0 and ${tot}.`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await saveQuickMarks({
        test_name: testName || 'Class Test',
        subject: subject || 'General',
        date: testDate || undefined,
        records: [{ student_id: student.id, obtained_marks: obt, total_marks: tot }],
      })

      const items = res.dispatches && res.dispatches.length > 0 ? res.dispatches : buildLocalDispatches([student])
      setDispatches(items)
      setDispatchModalOpen(true)
    } catch (err) {
      console.warn('Backend quick marks failed, using local dispatch:', err)
      const fallbackDispatches = buildLocalDispatches([student])
      setDispatches(fallbackDispatches)
      setDispatchModalOpen(true)
    } finally {
      setSaving(false)
    }
  }

  // Save and open dispatch for ALL filled students
  async function handleDispatchAll() {
    if (filledStudents.length === 0) {
      alert('Please enter marks for at least one student first.')
      return
    }

    // Validation
    const records = []
    for (const s of filledStudents) {
      const entry = marksData[s.id]
      const obt = Number(entry.obtained)
      const tot = Number(entry.total)
      if (obt < 0 || obt > tot) {
        alert(`Invalid mark for ${s.name}: obtained (${obt}) must be between 0 and ${tot}.`)
        return
      }
      records.push({ student_id: s.id, obtained_marks: obt, total_marks: tot })
    }

    setSaving(true)
    setError(null)
    try {
      const res = await saveQuickMarks({
        test_name: testName || 'Class Test',
        subject: subject || 'General',
        date: testDate || undefined,
        records,
      })

      const items = res.dispatches && res.dispatches.length > 0 ? res.dispatches : buildLocalDispatches(filledStudents)
      setDispatches(items)
      setDispatchModalOpen(true)
      setSuccessMsg(`Successfully processed marks for ${items.length} student(s)!`)
    } catch (err) {
      console.warn('Backend quick marks failed, using local dispatch:', err)
      const fallbackDispatches = buildLocalDispatches(filledStudents)
      setDispatches(fallbackDispatches)
      setDispatchModalOpen(true)
      setSuccessMsg(`Prepared WhatsApp cards for ${fallbackDispatches.length} student(s).`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quick Test Results"
        subtitle="Enter test marks and send instant bilingual WhatsApp result cards to parents — no class or batch setup required"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-lg px-3.5 py-2 shadow-xs transition-colors"
            >
              <i className="fa-solid fa-rotate-left mr-1.5 text-gray-400"></i>
              Reset All
            </button>

            <button
              type="button"
              onClick={handleDispatchAll}
              disabled={saving || filledStudents.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
            >
              {saving ? (
                <Spinner size="sm" />
              ) : (
                <i className="fa-brands fa-whatsapp text-emerald-400 text-base"></i>
              )}
              <span>Dispatch All Results ({filledStudents.length})</span>
            </button>
          </div>
        }
      />

      {error && <ErrorAlert message={error} />}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3 flex items-center justify-between">
          <span>
            <i className="fa-solid fa-circle-check text-emerald-600 mr-2"></i>
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Top Test Settings Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <i className="fa-solid fa-sliders text-indigo-600"></i>
          Quick Test Configuration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Test / Quiz Title
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. Weekly Test, Chapter 4 Quiz"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics, Physics, English"
              list="common-subjects"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <datalist id="common-subjects">
              <option value="Mathematics" />
              <option value="Physics" />
              <option value="Chemistry" />
              <option value="Biology" />
              <option value="English" />
              <option value="Urdu" />
              <option value="Islamiat" />
              <option value="Computer Science" />
              <option value="General" />
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Default Total Marks
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={defaultTotalMarks}
                onChange={(e) => handleDefaultTotalChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400 pointer-events-none">
                Marks
              </span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Applies to all students automatically
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
            <i className="fa-solid fa-magnifying-glass"></i>
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name, student ID, or WhatsApp..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Filter modes and counters */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterMode === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('filled')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterMode === 'filled' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Entered ({filledStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('empty')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filterMode === 'empty' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Pending ({students.length - filledStudents.length})
            </button>
          </div>

          {filledStudents.length > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-800">
              <i className="fa-solid fa-chart-line text-indigo-600"></i>
              <span>Class Avg: <strong>{avgPercentage}%</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Main Students Marks Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="No students match your search"
            subtitle="Try changing your search terms or filters."
            icon="fa-user-graduate"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5 text-left">Student Info</th>
                  <th className="px-4 py-3.5 text-left">Guardian & WhatsApp</th>
                  <th className="px-4 py-3.5 text-center w-28">Total Marks</th>
                  <th className="px-4 py-3.5 text-center w-36">Obtained Marks</th>
                  <th className="px-4 py-3.5 text-center w-28">Percentage</th>
                  <th className="px-4 py-3.5 text-center w-20">Grade</th>
                  <th className="px-5 py-3.5 text-right w-44">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((s, idx) => {
                  const entry = marksData[s.id] || { obtained: '', total: defaultTotalMarks }
                  const hasMark = entry.obtained !== '' && entry.obtained !== undefined
                  const obtNum = Number(entry.obtained)
                  const totNum = Number(entry.total) || 1
                  const isInvalid = hasMark && (obtNum < 0 || obtNum > totNum)
                  const pct = hasMark && !isInvalid ? Math.round((obtNum / totNum) * 100) : null
                  const grade = pct !== null ? computeGrade(pct) : '—'

                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${
                        hasMark ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      {/* Student Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {s.name
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{s.name}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              {s.student_code && (
                                <span className="font-mono text-gray-400 font-medium">
                                  {s.student_code}
                                </span>
                              )}
                              {(s.class_room?.name || s.batch?.name) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]">
                                  {s.class_room?.name || '—'} / {s.batch?.name || '—'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Guardian & WhatsApp */}
                      <td className="px-4 py-3.5">
                        <div className="text-gray-800 font-medium text-xs">
                          {s.guardian_name || 'Parent/Guardian'}
                        </div>
                        <div className="text-xs text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                          <i className="fa-brands fa-whatsapp text-emerald-600"></i>
                          <span>{s.whatsapp_number || 'No number'}</span>
                        </div>
                      </td>

                      {/* Total Marks */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={entry.total}
                          onChange={(e) => handleRowTotalChange(s.id, e.target.value)}
                          className="w-20 text-center font-medium rounded-lg border border-gray-300 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Obtained Marks */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="relative inline-block">
                          <input
                            ref={(el) => (inputRefs.current[s.id] = el)}
                            type="number"
                            step="0.5"
                            min="0"
                            max={entry.total}
                            value={entry.obtained}
                            onChange={(e) => handleObtainedChange(s.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                e.preventDefault()
                                const nextStudent = filteredStudents[idx + 1]
                                if (nextStudent && inputRefs.current[nextStudent.id]) {
                                  inputRefs.current[nextStudent.id].focus()
                                  inputRefs.current[nextStudent.id].select()
                                }
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault()
                                const prevStudent = filteredStudents[idx - 1]
                                if (prevStudent && inputRefs.current[prevStudent.id]) {
                                  inputRefs.current[prevStudent.id].focus()
                                  inputRefs.current[prevStudent.id].select()
                                }
                              }
                            }}
                            placeholder="Score"
                            className={`w-28 text-center font-bold rounded-lg border py-1.5 text-sm focus:outline-none focus:ring-2 ${
                              isInvalid
                                ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-500'
                                : hasMark
                                ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 focus:ring-indigo-500'
                                : 'border-gray-300 text-gray-800 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                        {isInvalid && (
                          <span className="block text-[11px] text-red-600 mt-1 font-medium">
                            0 - {entry.total}
                          </span>
                        )}
                      </td>

                      {/* Percentage Badge */}
                      <td className="px-4 py-3.5 text-center">
                        {pct !== null ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              pct >= 75
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : pct >= 50
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {pct}%
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Grade Badge */}
                      <td className="px-4 py-3.5 text-center">
                        {pct !== null ? (
                          <span
                            className={`inline-block font-extrabold text-sm ${
                              pct >= 75
                                ? 'text-emerald-700'
                                : pct >= 50
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {grade}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* Row Action */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasMark && (
                            <button
                              type="button"
                              onClick={() => clearRow(s.id)}
                              className="text-gray-400 hover:text-gray-600 p-1 rounded"
                              title="Clear marks"
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendSingle(s)}
                            disabled={!hasMark || isInvalid || saving}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs ${
                              hasMark && !isInvalid
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <i className="fa-brands fa-whatsapp text-sm"></i>
                            <span>Send</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp Dispatch Modal */}
      <QuickMarksDispatchModal
        open={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        dispatches={dispatches}
        testName={testName}
        subject={subject}
      />
    </div>
  )
}
