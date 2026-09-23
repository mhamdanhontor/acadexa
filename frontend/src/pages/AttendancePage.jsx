import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listClasses, listBatches } from '../api/academicStructure'
import { listStudents } from '../api/students'
import { getAttendanceByDate, saveBulkAttendance, getAbsentNotifications } from '../api/attendance'
import { normalizeError } from '../api/client'
import { useUnsavedChangesWarning, confirmLeaveIfUnsaved } from '../hooks/useUnsavedChangesWarning'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import AttendanceDispatchModal from '../components/AttendanceDispatchModal'
import AttendanceAlreadyMarkedModal from '../components/AttendanceAlreadyMarkedModal'

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present', activeClass: 'bg-green-600 text-white' },
  { value: 'ABSENT', label: 'Absent', activeClass: 'bg-red-600 text-white' },
  { value: 'LATE', label: 'Late', activeClass: 'bg-yellow-500 text-white' },
  { value: 'LEAVE', label: 'Leave', activeClass: 'bg-blue-600 text-white' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [absentees, setAbsentees] = useState([])
  const [autoSendFirst, setAutoSendFirst] = useState(false)

  // Attendance already marked modal state
  const [alreadyMarkedModalOpen, setAlreadyMarkedModalOpen] = useState(false)
  const [alreadyMarkedCheckedKey, setAlreadyMarkedCheckedKey] = useState('')
  const [alreadyMarkedCounts, setAlreadyMarkedCounts] = useState({ PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 })

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(statusMap) !== JSON.stringify(savedStatusMap),
    [statusMap, savedStatusMap]
  )
  useUnsavedChangesWarning(hasUnsavedChanges)

  async function loadLookups() {
    try {
      const [c, b] = await Promise.all([listClasses({ page_size: 100 }), listBatches({ page_size: 100 })])
      const cls = Array.isArray(c) ? c : (c?.items || [])
      const bts = Array.isArray(b) ? b : (b?.items || [])
      setClasses(cls)
      setBatches(bts)
      if (cls.length > 0 && !classId) setClassId(String(cls[0].id))
      if (bts.length > 0 && !batchId) setBatchId(String(bts[0].id))
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
      const raw = Array.isArray(studentData) ? studentData : (studentData?.items || [])
      const sItems = [...raw].sort((a, b) =>
        (a.student_code || '').localeCompare(b.student_code || '', undefined, { numeric: true }) || (a.id - b.id)
      )
      const recs = Array.isArray(existingRecords) ? existingRecords : (existingRecords?.items || [])
      setStudents(sItems)

      const map = {}
      sItems.forEach((s) => {
        map[s.id] = 'PRESENT' // sensible default; teacher adjusts exceptions
      })
      recs.forEach((r) => {
        map[r.student_id] = r.status
      })
      setStatusMap(map)
      setSavedStatusMap(map)

      const key = `${classId}-${batchId}-${date}`
      const todayISO = new Date().toISOString().slice(0, 10)
      if (recs.length > 0 && date === todayISO && alreadyMarkedCheckedKey !== key) {
        setAlreadyMarkedCheckedKey(key)
        const markedCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 }
        recs.forEach((r) => {
          if (markedCounts[r.status] !== undefined) {
            markedCounts[r.status]++
          }
        })
        setAlreadyMarkedCounts(markedCounts)
        setAlreadyMarkedModalOpen(true)
      }
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

  async function loadAndOpenWhatsAppModal() {
    if (!classId || !batchId || !date) return
    try {
      const data = await getAbsentNotifications({ date, class_id: Number(classId), batch_id: Number(batchId) })
      setAbsentees(Array.isArray(data) ? data : [])
      setAutoSendFirst(false)
      setWhatsappModalOpen(true)
    } catch (err) {
      setError(normalizeError(err).message)
    }
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
      const notifyCount = (result.absent || 0) + (result.leave || 0) + (result.late || 0)
      setSuccessMsg(
        `Saved. Present: ${result.present}, Absent: ${result.absent}, Late: ${result.late}, Leave: ${result.leave}. ` +
          `WhatsApp notifications queued: ${result.notifications_queued}.`
      )
      if (notifyCount > 0) {
        setAutoSendFirst(true)
        if (Array.isArray(result.absent_notifications) && result.absent_notifications.length > 0) {
          setAbsentees(result.absent_notifications)
          setWhatsappModalOpen(true)
        } else {
          loadAndOpenWhatsAppModal()
        }
      }
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

      {/* Mode Navigation Tabs */}
      <div className="flex gap-2 mb-4">
        <Link
          to="/attendance/quick"
          className="text-sm font-medium px-4 py-2 rounded-md bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-users"></i>
          All Enrolled Students
        </Link>
        <Link
          to="/attendance"
          className="text-sm font-medium px-4 py-2 rounded-md bg-indigo-600 text-white shadow-xs flex items-center gap-2"
        >
          <i className="fas fa-layer-group"></i>
          By Class & Batch
        </Link>
      </div>

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

          {((counts['ABSENT'] || 0) + (counts['LEAVE'] || 0) + (counts['LATE'] || 0)) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 text-lg shadow-xs">
                  <i className="fab fa-whatsapp"></i>
                </div>
                <div>
                  <span className="text-sm font-semibold text-emerald-950">
                    {(counts['ABSENT'] || 0) + (counts['LEAVE'] || 0) + (counts['LATE'] || 0)} student{((counts['ABSENT'] || 0) + (counts['LEAVE'] || 0) + (counts['LATE'] || 0)) > 1 ? 's' : ''} marked Absent, Late or on Leave
                  </span>
                  <p className="text-xs text-emerald-800">
                    Send WhatsApp absence alerts, late arrival notices, and approved leave acknowledgments directly to parents from your Admin WhatsApp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadAndOpenWhatsAppModal}
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer"
              >
                <i className="fab fa-whatsapp text-sm"></i>
                Send WhatsApp ({(counts['ABSENT'] || 0) + (counts['LEAVE'] || 0) + (counts['LATE'] || 0)})
              </button>
            </div>
          )}

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

      <AttendanceDispatchModal
        open={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        absentees={absentees}
        sessionDate={date}
        className={classes.find((c) => String(c.id) === String(classId))?.name || ''}
        batchName={batches.find((b) => String(b.id) === String(batchId))?.name || ''}
        autoSendFirst={autoSendFirst}
      />

      <AttendanceAlreadyMarkedModal
        open={alreadyMarkedModalOpen}
        onClose={() => setAlreadyMarkedModalOpen(false)}
        sessionDate={date}
        className={classes.find((c) => String(c.id) === String(classId))?.name || ''}
        batchName={batches.find((b) => String(b.id) === String(batchId))?.name || ''}
        counts={alreadyMarkedCounts}
        totalStudents={students.length}
        onOpenWhatsApp={loadAndOpenWhatsAppModal}
      />
    </div>
  )
}
