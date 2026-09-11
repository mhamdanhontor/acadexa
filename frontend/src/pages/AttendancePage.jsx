import { useEffect, useMemo, useState } from 'react'
import { listClasses, listBatches } from '../api/academicStructure'
import { listStudents } from '../api/students'
import { getAttendanceByDate, saveBulkAttendance } from '../api/attendance'
import { normalizeError } from '../api/client'
import { useUnsavedChangesWarning, confirmLeaveIfUnsaved } from '../hooks/useUnsavedChangesWarning'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present', activeClass: 'bg-green-600 text-white' },
  { value: 'ABSENT', label: 'Absent', activeClass: 'bg-red-600 text-white' },
  { value: 'LATE', label: 'Late', activeClass: 'bg-yellow-500 text-white' },
  { value: 'LEAVE', label: 'Leave', activeClass: 'bg-blue-600 text-white' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function AttendancePage() {
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [classId, setClassId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [date, setDate] = useState(todayISO())

  const [students, setStudents] = useState([])
  const [statusMap, setStatusMap] = useState({}) // student_id -> status
  const [savedStatusMap, setSavedStatusMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(statusMap) !== JSON.stringify(savedStatusMap),
    [statusMap, savedStatusMap]
  )
  useUnsavedChangesWarning(hasUnsavedChanges)

  async function loadLookups() {
    try {
      const [c, b] = await Promise.all([listClasses({ page_size: 100 }), listBatches({ page_size: 100 })])
      setClasses(c.items)
      setBatches(b.items)
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  useEffect(() => {
    loadLookups()
  }, [])

  async function loadRoster() {
    if (!classId || !batchId || !date) return
    if (hasUnsavedChanges && !confirmLeaveIfUnsaved(true)) return

    setLoading(true)
    setError(null)
    setSuccessMsg('')
    try {
      const [studentData, existingRecords] = await Promise.all([
        listStudents({ class_id: classId, batch_id: batchId, is_active: true, page_size: 200 }),
        getAttendanceByDate({ date, class_id: classId, batch_id: batchId }),
      ])
      setStudents(studentData.items)

      const map = {}
      studentData.items.forEach((s) => {
        map[s.id] = 'PRESENT' // sensible default; teacher adjusts exceptions
      })
      existingRecords.forEach((r) => {
        map[r.student_id] = r.status
      })
      setStatusMap(map)
      setSavedStatusMap(map)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, batchId, date])

  function setStatus(studentId, status) {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }))
  }

  function markAllPresent() {
    const map = {}
    students.forEach((s) => {
      map[s.id] = 'PRESENT'
    })
    setStatusMap(map)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccessMsg('')
    try {
      const records = students.map((s) => ({ student_id: s.id, status: statusMap[s.id] || 'PRESENT' }))
      const result = await saveBulkAttendance({
        date,
        class_id: Number(classId),
        batch_id: Number(batchId),
        records,
      })
      setSavedStatusMap(statusMap)
      setSuccessMsg(
        `Saved. Present: ${result.present}, Absent: ${result.absent}, Late: ${result.late}, Leave: ${result.leave}. ` +
          `Absence notifications queued: ${result.notifications_queued}.`
      )
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  const counts = STATUS_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = Object.values(statusMap).filter((v) => v === opt.value).length
    return acc
  }, {})

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark daily attendance for a class and batch" />

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
          <input
            id="attendance-date-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayISO()}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Class</label>
          <select id="attendance-class-select" value={classId} onChange={(e) => setClassId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
          <select id="attendance-batch-select" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Select batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {students.length > 0 && (
          <button onClick={markAllPresent} className="ml-auto bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium px-4 py-2 rounded-md">
            <i className="fas fa-check-double mr-2"></i>Mark All Present
          </button>
        )}
      </div>

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={loadRoster} /></div>}
      {successMsg && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm">
          <i className="fas fa-circle-check mr-2"></i>{successMsg}
        </div>
      )}

      {!classId || !batchId ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState title="Select a class and batch" subtitle="Choose class, batch and date to load the roster." icon="fa-calendar-check" />
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState title="No active students in this class/batch" icon="fa-user-graduate" />
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-4">
            {STATUS_OPTIONS.map((opt) => (
              <div key={opt.value} className="bg-white rounded-lg border border-gray-200 px-4 py-2 text-sm">
                <span className="text-gray-500">{opt.label}:</span>{' '}
                <span className="font-semibold text-gray-800">{counts[opt.value] || 0}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Student ID</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 text-gray-600">{s.student_code}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                          const isActive = statusMap[s.id] === opt.value
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setStatus(s.id, opt.value)}
                              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                                isActive ? `${opt.activeClass} border-transparent` : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
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
              {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Attendance' : 'Saved'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
