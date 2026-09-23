import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllEnrolledAttendance, saveAllEnrolledAttendance } from '../api/attendance'
import { listClasses, listBatches } from '../api/academicStructure'
import { normalizeError } from '../api/client'
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import AttendanceDispatchModal from '../components/AttendanceDispatchModal'
import AttendanceAlreadyMarkedModal from '../components/AttendanceAlreadyMarkedModal'

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present', activeClass: 'bg-green-600 text-white shadow-xs' },
  { value: 'ABSENT', label: 'Absent', activeClass: 'bg-red-600 text-white shadow-xs' },
  { value: 'LEAVE', label: 'Leave', activeClass: 'bg-blue-600 text-white shadow-xs' },
  { value: 'LATE', label: 'Late', activeClass: 'bg-yellow-500 text-white shadow-xs' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function QuickAttendancePage() {
  const [date, setDate] = useState(todayISO())
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // State maps
  const [statusMap, setStatusMap] = useState({}) // student_id -> status
  const [savedStatusMap, setSavedStatusMap] = useState({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  // WhatsApp Dispatch modal state
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false)
  const [dispatches, setDispatches] = useState([])
  const [autoSendFirst, setAutoSendFirst] = useState(false)

  // Attendance already marked modal state
  const [alreadyMarkedModalOpen, setAlreadyMarkedModalOpen] = useState(false)
  const [alreadyMarkedCheckedDate, setAlreadyMarkedCheckedDate] = useState('')
  const [alreadyMarkedCounts, setAlreadyMarkedCounts] = useState({ PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 })

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(statusMap) !== JSON.stringify(savedStatusMap),
    [statusMap, savedStatusMap]
  )
  useUnsavedChangesWarning(hasUnsavedChanges)

  async function loadInitialData() {
    try {
      const [c, b] = await Promise.all([listClasses({ page_size: 100 }), listBatches({ page_size: 100 })])
      setClasses(Array.isArray(c) ? c : (c?.items || []))
      setBatches(Array.isArray(b) ? b : (b?.items || []))
    } catch (err) {
      console.error('Failed to load academic structure lookups:', err)
    }
  }

  async function loadRoster() {
    setLoading(true)
    setError(null)
    setSuccessMsg('')
    try {
      const data = await getAllEnrolledAttendance(date)
      const rawItems = Array.isArray(data) ? data : []
      const items = [...rawItems].sort((a, b) =>
        (a.student_code || '').localeCompare(b.student_code || '', undefined, { numeric: true }) || ((a.student_id || 0) - (b.student_id || 0))
      )
      setStudents(items)

      const map = {}
      items.forEach((s) => {
        map[s.student_id] = s.current_status || 'PRESENT'
      })
      setStatusMap(map)
      setSavedStatusMap(map)

      const markedItems = items.filter((s) => s.attendance_id != null)
      const today = new Date().toISOString().slice(0, 10)
      if (markedItems.length > 0 && date === today && alreadyMarkedCheckedDate !== date) {
        setAlreadyMarkedCheckedDate(date)
        const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 }
        markedItems.forEach((s) => {
          if (counts[s.current_status] !== undefined) {
            counts[s.current_status]++
          }
        })
        setAlreadyMarkedCounts(counts)
        setAlreadyMarkedModalOpen(true)
      }
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function setStatus(studentId, status) {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }))
  }

  function markAllPresent() {
    const map = { ...statusMap }
    filteredStudents.forEach((s) => {
      map[s.student_id] = 'PRESENT'
    })
    setStatusMap(map)
  }

  function markAllAbsent() {
    const map = { ...statusMap }
    filteredStudents.forEach((s) => {
      map[s.student_id] = 'ABSENT'
    })
    setStatusMap(map)
  }

  // Filter students based on search and selected class/batch/status
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterClass && String(s.class_id) !== String(filterClass)) return false
      if (filterBatch && String(s.batch_id) !== String(filterBatch)) return false
      if (filterStatus && (statusMap[s.student_id] || 'PRESENT') !== filterStatus) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchName = (s.student_name || '').toLowerCase().includes(q)
        const matchCode = (s.student_code || '').toLowerCase().includes(q)
        const matchGuardian = (s.guardian_name || '').toLowerCase().includes(q)
        if (!matchName && !matchCode && !matchGuardian) return false
      }
      return true
    })
  }, [students, filterClass, filterBatch, filterStatus, searchQuery, statusMap])

  // Count aggregate stats across ALL loaded students
  const counts = useMemo(() => {
    const initial = { PRESENT: 0, ABSENT: 0, LEAVE: 0, LATE: 0 }
    students.forEach((s) => {
      const st = statusMap[s.student_id] || 'PRESENT'
      if (initial[st] !== undefined) initial[st]++
    })
    return initial
  }, [students, statusMap])

  const notifyCount = (counts.ABSENT || 0) + (counts.LEAVE || 0)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccessMsg('')
    try {
      const records = students.map((s) => ({
        student_id: s.student_id,
        status: statusMap[s.student_id] || 'PRESENT',
      }))

      const result = await saveAllEnrolledAttendance({
        date,
        records,
      })

      setSavedStatusMap(statusMap)
      setSuccessMsg(
        `Attendance saved successfully for ${result.total} students. ` +
          `Present: ${result.present}, Absent: ${result.absent}, Leave: ${result.leave}, Late: ${result.late}. ` +
          `WhatsApp alerts queued: ${result.notifications_queued}.`
      )

      if (Array.isArray(result.dispatches) && result.dispatches.length > 0) {
        setDispatches(result.dispatches)
        setAutoSendFirst(true)
        setDispatchModalOpen(true)
      }
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="All Students Attendance"
        subtitle="Mark academy-wide attendance across all classes and batches with automated WhatsApp dispatch"
      />

      {/* Mode Navigation Tabs */}
      <div className="flex gap-2 mb-4">
        <Link
          to="/attendance/quick"
          className="text-sm font-medium px-4 py-2 rounded-md bg-indigo-600 text-white shadow-xs flex items-center gap-2"
        >
          <i className="fas fa-users"></i>
          All Enrolled Students
        </Link>
        <Link
          to="/attendance"
          className="text-sm font-medium px-4 py-2 rounded-md bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <i className="fas fa-layer-group"></i>
          By Class & Batch
        </Link>
      </div>

      {/* Date & Filter Controls Card */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayISO()}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Search Student
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Name or Student Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <i className="fas fa-search absolute left-2.5 top-3 text-xs text-gray-400"></i>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Filter by Class
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Filter by Batch
            </label>
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-xs focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LEAVE">Leave</option>
              <option value="LATE">Late</option>
            </select>
          </div>
        </div>

        {/* Quick batch action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 text-xs">
          <div className="text-gray-500">
            Showing <strong className="text-gray-800">{filteredStudents.length}</strong> of{' '}
            <strong className="text-gray-800">{students.length}</strong> enrolled students
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllPresent}
              className="bg-green-50 hover:bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <i className="fas fa-check-double text-xs"></i>
              Mark Filtered Present
            </button>
            <button
              type="button"
              onClick={markAllAbsent}
              className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <i className="fas fa-user-xmark text-xs"></i>
              Mark Filtered Absent
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} onRetry={loadRoster} />
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <i className="fas fa-circle-check text-green-600 text-base"></i>
            {successMsg}
          </span>
          {dispatches.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAutoSendFirst(false)
                setDispatchModalOpen(true)
              }}
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold px-3 py-1.5 rounded shadow-xs flex items-center gap-1.5"
            >
              <i className="fab fa-whatsapp"></i>
              Open WhatsApp Dispatch ({dispatches.length})
            </button>
          )}
        </div>
      )}

      {/* Live Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <span className="text-xs text-gray-500 font-medium uppercase">Total Enrolled</span>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{students.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <span className="text-xs text-green-600 font-semibold uppercase">Present</span>
          <p className="text-xl font-bold text-green-700 mt-0.5">{counts.PRESENT || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <span className="text-xs text-red-600 font-semibold uppercase">Absent</span>
          <p className="text-xl font-bold text-red-700 mt-0.5">{counts.ABSENT || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <span className="text-xs text-blue-600 font-semibold uppercase">Leave</span>
          <p className="text-xl font-bold text-blue-700 mt-0.5">{counts.LEAVE || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
          <span className="text-xs text-amber-600 font-semibold uppercase">Late</span>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{counts.LATE || 0}</p>
        </div>
      </div>

      {/* WhatsApp Dispatch Heads-Up Banner */}
      {notifyCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 text-lg shadow-xs">
              <i className="fab fa-whatsapp"></i>
            </div>
            <div>
              <span className="text-sm font-semibold text-emerald-950">
                {notifyCount} student{notifyCount > 1 ? 's' : ''} marked Absent or on Leave
              </span>
              <p className="text-xs text-emerald-800">
                When you click <strong>Save Attendance</strong>, personalized WhatsApp messages will be prepared for all Absent ({counts.ABSENT || 0}) and Leave ({counts.LEAVE || 0}) students with an automated 10-second safe pacing delay.
              </p>
            </div>
          </div>
          {dispatches.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAutoSendFirst(false)
                setDispatchModalOpen(true)
              }}
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <i className="fab fa-whatsapp text-sm"></i>
              Open WhatsApp Modal ({dispatches.length})
            </button>
          )}
        </div>
      )}

      {/* Roster Table */}
      {loading ? (
        <div className="flex justify-center py-20 bg-white rounded-xl border border-gray-200">
          <Spinner size="lg" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            title="No enrolled students found"
            subtitle="Please ensure active students are enrolled in the academy."
            icon="fa-user-graduate"
          />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            title="No students match the current filters"
            subtitle="Try clearing your search query or class/batch filter."
            icon="fa-filter"
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wider">Student ID</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wider">Student & Guardian</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wider">Class & Batch</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wider">WhatsApp Number</th>
                  <th className="px-5 py-3 font-semibold text-xs uppercase tracking-wider">Mark Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((s) => {
                  const current = statusMap[s.student_id] || 'PRESENT'
                  return (
                    <tr key={s.student_id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-gray-600">
                        {s.student_code}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{s.student_name}</div>
                        <div className="text-xs text-gray-400">
                          Guardian: <span className="text-gray-600">{s.guardian_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium border border-indigo-100">
                            {s.class_name}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                            {s.batch_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-emerald-700 font-mono inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          <i className="fab fa-whatsapp text-emerald-600"></i>
                          +{s.whatsapp_number.replace(/^\+/, '')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="inline-flex rounded-lg shadow-xs border border-gray-200 bg-white p-0.5">
                          {STATUS_OPTIONS.map((opt) => {
                            const isActive = current === opt.value
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setStatus(s.student_id, opt.value)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                                  isActive
                                    ? opt.activeClass
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Floating Save Action Bar */}
          <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {hasUnsavedChanges ? (
                <span className="text-amber-600 font-medium flex items-center gap-1.5">
                  <i className="fas fa-circle-exclamation"></i>
                  You have unsaved changes. Click Save Attendance to commit and prepare WhatsApp alerts.
                </span>
              ) : (
                <span className="text-green-600 font-medium flex items-center gap-1.5">
                  <i className="fas fa-circle-check"></i>
                  All records on screen are in sync with the database.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              {saving ? <Spinner size="sm" /> : <i className="fas fa-paper-plane"></i>}
              {saving ? 'Saving & Generating Messages...' : 'Save Attendance & Dispatch WhatsApp'}
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Dispatch Modal */}
      <AttendanceDispatchModal
        open={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        dispatches={dispatches}
        sessionDate={date}
        autoSendFirst={autoSendFirst}
      />

      {/* Attendance Already Marked Today Modal */}
      <AttendanceAlreadyMarkedModal
        open={alreadyMarkedModalOpen}
        onClose={() => setAlreadyMarkedModalOpen(false)}
        sessionDate={date}
        className="All Classes & Batches"
        batchName=""
        counts={alreadyMarkedCounts}
        totalStudents={students.length}
        onOpenWhatsApp={() => {
          setAutoSendFirst(false)
          setDispatchModalOpen(true)
        }}
      />
    </div>
  )
}
