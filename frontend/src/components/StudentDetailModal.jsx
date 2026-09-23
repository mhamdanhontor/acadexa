import { useEffect, useState } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import StatusBadge from './StatusBadge'
import { listAttendance, getAttendanceSummary } from '../api/attendance'
import { listMarks } from '../api/academics'
import { normalizeError } from '../api/client'
import { openWhatsApp } from '../utils/whatsapp'

export default function StudentDetailModal({ open, onClose, student }) {
  const [activeTab, setActiveTab] = useState('attendance') // 'attendance' | 'marks' | 'fees'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Attendance data
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [attendanceSummary, setAttendanceSummary] = useState(null)

  // Marks data
  const [marksRecords, setMarksRecords] = useState([])

  // Quick fee receipt state
  const [feeAmount, setFeeAmount] = useState('5000')
  const [feeMonth, setFeeMonth] = useState('September 2026')
  const [receiptNo, setReceiptNo] = useState(`REC-${Math.floor(1000 + Math.random() * 9000)}`)

  async function loadStudentHistory() {
    if (!student?.id) return
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch attendance records
      const attData = await listAttendance({ student_id: student.id, page_size: 100 })
      const attItems = Array.isArray(attData) ? attData : attData?.items || []
      setAttendanceRecords(attItems)

      // 2. Fetch attendance summary
      const dNow = new Date()
      const dFrom = new Date()
      dFrom.setDate(dFrom.getDate() - 90) // Last 90 days
      const dateTo = dNow.toISOString().split('T')[0]
      const dateFrom = dFrom.toISOString().split('T')[0]

      try {
        const sum = await getAttendanceSummary({ student_id: student.id, date_from: dateFrom, date_to: dateTo })
        setAttendanceSummary(sum)
      } catch (err) {
        console.warn('Attendance summary lookup skipped:', err)
      }

      // 3. Fetch marks records
      const marksData = await listMarks({ student_id: student.id, page_size: 100 })
      const mItems = Array.isArray(marksData) ? marksData : marksData?.items || []
      setMarksRecords(mItems)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && student) {
      loadStudentHistory()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student])

  if (!student) return null

  function handleSendFeeReceipt() {
    const academyName = 'Honor Knowledge Academy'
    const today = new Date().toISOString().split('T')[0]
    const guardian = student.guardian_name || 'Parent/Guardian'
    const guardianUr = student.guardian_name_ur || guardian
    const studentNameUr = student.name_ur || student.name

    const msg =
      `*FEE PAYMENT RECEIPT*\n*Assalam-o-Alaikum*\n\n` +
      `Dear Parent/Guardian (*${guardian}*),\n\n` +
      `Fee payment confirmation for *${student.name}*:\n\n` +
      `💵 *Amount Paid:* PKR ${feeAmount}\n` +
      `📅 *Month/Period:* ${feeMonth}\n` +
      `🧾 *Receipt #:* ${receiptNo}\n` +
      `🗓 *Payment Date:* ${today}\n\n` +
      `Thank you for your timely payment and continued support.\n\n` +
      `Best regards,\n` +
      `*${academyName}*\n\n` +
      `-----------------------------------\n\n` +
      `*فیس وصولی کی رسید*\n*السلام علیکم*\n\n` +
      `محترم والدین / سرپرست (*${guardianUr}*)،\n\n` +
      `آپ کے بچے *${studentNameUr}* کی فیس کی ادائیگی کی تصدیق درج ذیل ہے:\n\n` +
      `💵 *وصول شدہ رقم:* PKR ${feeAmount}\n` +
      `📅 *ماہ:* ${feeMonth}\n` +
      `🧾 *رسید نمبر:* #${receiptNo}\n` +
      `🗓 *تاریخِ ادائیگی:* ${today}\n\n` +
      `بروقت ادائیگی اور تعاون کا شکریہ!\n\n` +
      `والسلام،\n` +
      `*${academyName}*`

    openWhatsApp(student.whatsapp_number, msg, 'web')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Student Profile & Academic Record — ${student.name}`}
      width="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Student Profile Overview Card */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
                {student.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
                  {student.name_ur && (
                    <span className="text-sm font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-serif">
                      {student.name_ur}
                    </span>
                  )}
                  <StatusBadge status={student.is_active} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-1">
                  <span className="font-mono bg-white border border-gray-200 px-2 py-0.5 rounded-md font-semibold">
                    ID: {student.student_code || '—'}
                  </span>
                  <span>
                    Class: <strong>{student.class_room?.name || '—'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Batch: <strong>{student.batch?.name || '—'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Parent: <strong>{student.guardian_name || '—'}</strong>
                    {student.guardian_name_ur && (
                      <span className="text-gray-500 font-serif ml-1">({student.guardian_name_ur})</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${student.whatsapp_number?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <i className="fa-brands fa-whatsapp text-sm"></i>
                <span>{student.whatsapp_number}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 text-sm font-medium gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'attendance'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className="fa-solid fa-calendar-check"></i>
            Attendance Record ({attendanceRecords.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('marks')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'marks'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className="fa-solid fa-file-signature"></i>
            Tests & Marks ({marksRecords.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fees')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'fees'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className="fa-solid fa-receipt"></i>
            Fee Receipts & Invoices
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
            {error}
          </div>
        ) : (
          <>
            {/* TAB 1: ATTENDANCE */}
            {activeTab === 'attendance' && (
              <div className="space-y-4">
                {/* Stats cards */}
                {attendanceSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-white border border-gray-200 p-3 rounded-xl text-center">
                      <span className="text-xs text-gray-400 font-medium block">Total Days</span>
                      <span className="text-lg font-bold text-gray-800">{attendanceSummary.total_days}</span>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center">
                      <span className="text-xs text-emerald-600 font-medium block">Present</span>
                      <span className="text-lg font-bold text-emerald-700">{attendanceSummary.present_days}</span>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-center">
                      <span className="text-xs text-rose-600 font-medium block">Absent</span>
                      <span className="text-lg font-bold text-rose-700">{attendanceSummary.absent_days}</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                      <span className="text-xs text-amber-600 font-medium block">Late</span>
                      <span className="text-lg font-bold text-amber-700">{attendanceSummary.late_days}</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center">
                      <span className="text-xs text-blue-600 font-medium block">Attendance</span>
                      <span className="text-lg font-bold text-blue-700">{attendanceSummary.percentage}%</span>
                    </div>
                  </div>
                )}

                {attendanceRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <i className="fa-solid fa-calendar-xmark text-3xl mb-2 text-gray-300"></i>
                    <p className="text-sm">No attendance records found for this student.</p>
                  </div>
                ) : (
                  <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 text-left">Date</th>
                          <th className="px-5 py-3 text-left">Status</th>
                          <th className="px-5 py-3 text-right">Recorded At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {attendanceRecords.map((att) => (
                          <tr key={att.id} className="hover:bg-gray-50/70">
                            <td className="px-5 py-2.5 font-medium text-gray-800">{att.date}</td>
                            <td className="px-5 py-2.5">
                              <StatusBadge status={att.status} />
                            </td>
                            <td className="px-5 py-2.5 text-right text-xs text-gray-400">
                              {new Date(att.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MARKS */}
            {activeTab === 'marks' && (
              <div className="space-y-4">
                {marksRecords.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <i className="fa-solid fa-clipboard-check text-3xl mb-2 text-gray-300"></i>
                    <p className="text-sm">No test marks recorded for this student yet.</p>
                  </div>
                ) : (
                  <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 text-left">Test Name</th>
                          <th className="px-4 py-3 text-center">Score</th>
                          <th className="px-4 py-3 text-center">Percentage</th>
                          <th className="px-4 py-3 text-center">Grade</th>
                          <th className="px-5 py-3 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {marksRecords.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50/70">
                            <td className="px-5 py-3 font-semibold text-gray-900">
                              {m.test?.name || `Test #${m.test_id}`}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-gray-800">
                              {m.obtained_marks} / {m.total_marks}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  m.percentage >= 75
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.percentage >= 50
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {m.percentage}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-black text-indigo-700">
                              {m.grade || '—'}
                            </td>
                            <td className="px-5 py-3 text-right text-xs text-gray-400">
                              {new Date(m.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: FEES */}
            {activeTab === 'fees' && (
              <div className="space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-3">
                  <i className="fa-solid fa-info-circle text-amber-600 text-base shrink-0 mt-0.5"></i>
                  <div>
                    <strong className="font-semibold block mb-0.5">Fee Ledger Note:</strong>
                    A complete database fee-tracking ledger (with monthly due dates and student arrears) can be connected. In the meantime, you can instantly dispatch official bilingual WhatsApp fee receipts to parents using the card below!
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
                  <h4 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-paper-plane text-emerald-600"></i>
                    Send WhatsApp Fee Receipt to Parent
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Amount Paid (PKR)
                      </label>
                      <input
                        type="text"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        placeholder="e.g. 5,000"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Month / Period
                      </label>
                      <input
                        type="text"
                        value={feeMonth}
                        onChange={(e) => setFeeMonth(e.target.value)}
                        placeholder="e.g. September 2026"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Receipt Number
                      </label>
                      <input
                        type="text"
                        value={receiptNo}
                        onChange={(e) => setReceiptNo(e.target.value)}
                        placeholder="e.g. REC-1042"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendFeeReceipt}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <i className="fa-brands fa-whatsapp text-sm"></i>
                    <span>Send Bilingual Fee Receipt via WhatsApp</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
