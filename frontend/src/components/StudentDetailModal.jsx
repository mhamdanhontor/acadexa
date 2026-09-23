import { useEffect, useState } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import StatusBadge from './StatusBadge'
import { listAttendance, getAttendanceSummary } from '../api/attendance'
import { listMarks } from '../api/academics'
import { normalizeError } from '../api/client'
import { openWhatsApp, cleanPhoneNumber, getStoredWhatsAppTarget, setStoredWhatsAppTarget } from '../utils/whatsapp'
import { downloadFeeVoucherPdf, printFeeVoucherPdf, getFormattedDueDate } from '../utils/feeVoucherPdf'

export default function StudentDetailModal({ open, onClose, student }) {
  const [activeTab, setActiveTab] = useState('attendance') // 'attendance' | 'marks' | 'fees'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Attendance data
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [attendanceSummary, setAttendanceSummary] = useState(null)

  // Marks data
  const [marksRecords, setMarksRecords] = useState([])

  // Fee state (simplified — no fines)
  const [feeAmount, setFeeAmount] = useState('5000')
  const [feeMonth, setFeeMonth] = useState('September 2026')
  const [receiptNo, setReceiptNo] = useState(`REC-${Math.floor(1000 + Math.random() * 9000)}`)
  const [target, setTarget] = useState(getStoredWhatsAppTarget() || 'desktop')
  const [voucherSentNotice, setVoucherSentNotice] = useState(false)
  const [downloadedFilename, setDownloadedFilename] = useState('')

  // Previous fee payment records (loaded from localStorage with default fallbacks)
  const [previousFeeRecords, setPreviousFeeRecords] = useState([])

  useEffect(() => {
    if (student?.id) {
      try {
        const stored = localStorage.getItem(`hka_fee_records_${student.id}`)
        if (stored) {
          setPreviousFeeRecords(JSON.parse(stored))
        } else {
          setPreviousFeeRecords([
            { month: 'August 2026', date: '2026-08-10', receipt: 'REC-9041', amount: 5000, status: 'PAID' },
            { month: 'July 2026', date: '2026-07-09', receipt: 'REC-8234', amount: 5000, status: 'PAID' },
          ])
        }
      } catch {
        setPreviousFeeRecords([])
      }
    }
  }, [student?.id])

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

  // Normalized Attendance KPIs (resolves backend field mismatch and fallback calculation)
  const totalDays =
    attendanceSummary?.total_classes ?? attendanceSummary?.total_days ?? attendanceRecords.length
  const presentDays =
    attendanceSummary?.present ??
    attendanceSummary?.present_days ??
    attendanceRecords.filter((r) => r.status === 'PRESENT').length
  const absentDays =
    attendanceSummary?.absent ??
    attendanceSummary?.absent_days ??
    attendanceRecords.filter((r) => r.status === 'ABSENT').length
  const lateDays =
    attendanceSummary?.late ??
    attendanceSummary?.late_days ??
    attendanceRecords.filter((r) => r.status === 'LATE').length
  const leaveDays =
    attendanceSummary?.leave ??
    attendanceSummary?.leave_days ??
    attendanceRecords.filter((r) => r.status === 'LEAVE').length
  const attendancePercentage =
    attendanceSummary?.percentage != null
      ? Math.round(attendanceSummary.percentage)
      : totalDays > 0
        ? Math.round(((presentDays + lateDays) / totalDays) * 100)
        : 100

  // Simplified Fee Calculations
  const tuitionNum = Number(feeAmount) || 0
  const today = new Date().toISOString().split('T')[0]

  function handleTargetChange(newTarget) {
    setTarget(newTarget)
    setStoredWhatsAppTarget(newTarget)
  }

  function saveCurrentPaymentToHistory() {
    const newEntry = {
      month: feeMonth,
      date: today,
      receipt: receiptNo,
      amount: tuitionNum,
      status: 'PAID',
    }
    const updated = [
      newEntry,
      ...previousFeeRecords.filter((r) => r.receipt !== receiptNo && r.month !== feeMonth),
    ].slice(0, 8)
    setPreviousFeeRecords(updated)
    try {
      localStorage.setItem(`hka_fee_records_${student.id}`, JSON.stringify(updated))
    } catch {}
  }

  function getVoucherPayload() {
    return {
      student,
      receiptNo,
      feeMonth,
      today,
      feeAmount: tuitionNum,
      totalPaid: tuitionNum,
      paymentMethod: 'Cash / Online',
      previousRecords: previousFeeRecords,
    }
  }

  function handleSendFeeReceipt() {
    const academyName = 'Honor Knowledge Academy'
    const guardian = student.guardian_name || 'Parent/Guardian'
    const guardianUr = student.guardian_name_ur || guardian
    const studentNameUr = student.name_ur || student.name

    // 1. Save payment into persistent student records
    saveCurrentPaymentToHistory()

    // 2. Generate & download official PDF voucher
    const payload = getVoucherPayload()
    const savedFile = downloadFeeVoucherPdf(payload)
    setDownloadedFilename(savedFile)
    setVoucherSentNotice(true)

    // 3. Prepare bilingual message formatted for parents (Simplified — No Fines)
    const msg =
      `*HONOR KNOWLEDGE ACADEMY*\n` +
      `*OFFICIAL FEE PAYMENT RECEIPT*\n` +
      `*Assalam-o-Alaikum*\n\n` +
      `Dear Parent/Guardian (*${guardian}*),\n\n` +
      `Fee payment confirmation for *${student.name}* (*${student.student_code}*):\n\n` +
      `💵 *Fee Amount Received:* PKR ${tuitionNum.toLocaleString()}\n` +
      `📅 *Billing Month:* ${feeMonth}\n` +
      `🧾 *Receipt #:* ${receiptNo}\n` +
      `🗓 *Date Received:* ${today}\n` +
      `✅ *Status:* PAID (Honor Knowledge Academy Official Stamp Applied)\n\n` +
      `📎 *Official PDF Fee Voucher has been generated and saved to your computer.* Please find the attached PDF.\n\n` +
      `Thank you for your prompt cooperation.\n\n` +
      `Best regards,\n` +
      `*${academyName}*\n\n` +
      `-----------------------------------\n\n` +
      `*فیس وصولی کی رسید*\n*السلام علیکم*\n\n` +
      `محترم والدین / سرپرست (*${guardianUr}*)،\n\n` +
      `آپ کے بچے *${studentNameUr}* کی فیس کی وصولی کی تصدیق درج ذیل ہے:\n\n` +
      `💵 *وصول شدہ فیس:* PKR ${tuitionNum.toLocaleString()}\n` +
      `📅 *ماہ:* ${feeMonth}\n` +
      `🧾 *رسید نمبر:* #${receiptNo}\n` +
      `🗓 *تاریخِ وصولی:* ${today}\n` +
      `✅ *حیثیت:* مکمل ادا شدہ (آنر نالج اکیڈمی کی باضابطہ مہر تصدیق کے ساتھ)\n\n` +
      `📎 باضابطہ PDF فیس واؤچر تیار کر کے آپ کے کمپیوٹر میں محفوظ کر دیا گیا ہے۔\n\n` +
      `والسلام،\n` +
      `*آنر نالج اکیڈمی*`

    // 4. Open WhatsApp Desktop (or selected target)
    openWhatsApp(student.whatsapp_number, msg, target)
  }

  function handleDownloadOnlyPdf() {
    saveCurrentPaymentToHistory()
    const payload = getVoucherPayload()
    const savedFile = downloadFeeVoucherPdf(payload)
    setDownloadedFilename(savedFile)
    setVoucherSentNotice(true)
  }

  function handlePrintPdf() {
    saveCurrentPaymentToHistory()
    const payload = getVoucherPayload()
    printFeeVoucherPdf(payload)
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
                {/* Stats cards (Reliably rendered with accurate counts) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-white border border-gray-200 p-3 rounded-xl text-center shadow-xs">
                    <span className="text-xs text-gray-400 font-medium block">Total Days</span>
                    <span className="text-lg font-bold text-gray-800">{totalDays}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center shadow-xs">
                    <span className="text-xs text-emerald-600 font-medium block">Present</span>
                    <span className="text-lg font-bold text-emerald-700">{presentDays}</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-center shadow-xs">
                    <span className="text-xs text-rose-600 font-medium block">Absent</span>
                    <span className="text-lg font-bold text-rose-700">{absentDays}</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center shadow-xs">
                    <span className="text-xs text-amber-600 font-medium block">Late</span>
                    <span className="text-lg font-bold text-amber-700">{lateDays}</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-center shadow-xs">
                    <span className="text-xs text-blue-600 font-medium block">Attendance</span>
                    <span className="text-lg font-bold text-blue-700">{attendancePercentage}%</span>
                  </div>
                </div>

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
                    <i className="fa-solid fa-chart-simple text-3xl mb-2 text-gray-300"></i>
                    <p className="text-sm">No test records found for this student.</p>
                  </div>
                ) : (
                  <div className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-xs">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-5 py-3 text-left">Test Name</th>
                          <th className="px-5 py-3 text-left">Subject</th>
                          <th className="px-5 py-3 text-right">Obtained Marks</th>
                          <th className="px-5 py-3 text-right">Total Marks</th>
                          <th className="px-5 py-3 text-right">Score (%)</th>
                          <th className="px-5 py-3 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {marksRecords.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50/70">
                            <td className="px-5 py-2.5 font-medium text-gray-800">
                              {m.test?.title || `Test #${m.test_id}`}
                            </td>
                            <td className="px-5 py-2.5 text-gray-600">
                              {m.test?.subject?.name || '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right font-bold text-gray-900">
                              {m.obtained_marks}
                            </td>
                            <td className="px-5 py-2.5 text-right text-gray-500">
                              {m.test?.total_marks || '—'}
                            </td>
                            <td className="px-5 py-2.5 text-right">
                              <span
                                className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                                  m.percentage >= 80
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : m.percentage >= 60
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {m.percentage != null ? `${m.percentage}%` : '—'}
                              </span>
                            </td>
                            <td className="px-5 py-2.5 text-right text-xs text-gray-400">
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

            {/* TAB 3: FEES (SIMPLIFIED & MODERN) */}
            {activeTab === 'fees' && (
              <div className="space-y-6">
                {/* Confirmation banner after sending */}
                {voucherSentNotice && (
                  <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 shadow-sm flex items-start gap-3.5 animate-fadeIn">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <i className="fa-solid fa-check text-sm"></i>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-emerald-950 text-sm">
                        PDF Fee Voucher Generated & WhatsApp Launched!
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                        The official PDF voucher{' '}
                        <strong className="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900">
                          {downloadedFilename || 'Fee_Receipt_HONOR.pdf'}
                        </strong>{' '}
                        was automatically saved to your <strong className="underline">Downloads</strong> folder.
                        Attach the voucher to WhatsApp and send it to the parent.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVoucherSentNotice(false)}
                      className="text-emerald-700 hover:text-emerald-950 p-1 text-sm"
                      title="Dismiss notice"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                )}

                {/* Simplified Controls Box */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-receipt text-indigo-600"></i>
                        <span>Honor Knowledge Academy — Fee Receipt Settings</span>
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Simplified fee receipt with student particulars, date received, previous records, and official PAID stamp.
                      </p>
                    </div>

                    {/* WhatsApp Target Selector */}
                    <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-medium">
                      <span className="text-gray-500 px-2 font-semibold">Open In:</span>
                      <button
                        type="button"
                        onClick={() => handleTargetChange('desktop')}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          target === 'desktop'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Opens Windows WhatsApp Desktop application via whatsapp://"
                      >
                        <i className="fa-solid fa-desktop text-xs"></i>
                        <span>WhatsApp Desktop</span>
                        <span className="text-[10px] bg-emerald-800/40 px-1 py-0.2 rounded font-normal">Active</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTargetChange('web')}
                        className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          target === 'web'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Opens web.whatsapp.com in your default browser"
                      >
                        <i className="fa-solid fa-globe text-xs"></i>
                        <span>Web</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTargetChange('universal')}
                        className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          target === 'universal'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Direct wa.me link"
                      >
                        <i className="fa-solid fa-mobile-screen text-xs"></i>
                        <span>wa.me</span>
                      </button>
                    </div>
                  </div>

                  {/* Clean Input Fields (No Fines) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Fee Amount Received (PKR)
                      </label>
                      <input
                        type="number"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Billing Month / Period
                      </label>
                      <input
                        type="text"
                        value={feeMonth}
                        onChange={(e) => setFeeMonth(e.target.value)}
                        placeholder="e.g. September 2026"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Receipt Number
                      </label>
                      <input
                        type="text"
                        value={receiptNo}
                        onChange={(e) => setReceiptNo(e.target.value)}
                        placeholder="e.g. REC-1042"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-gray-900 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* LIVE VOUCHER PREVIEW (MODERN, CLEAN, NO FINES) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  {/* Voucher Header Banner */}
                  <div className="bg-slate-900 text-white p-5 border-b-2 border-amber-500 relative">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-2xl shadow-inner">
                          <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black tracking-wider text-white">
                              HONOR KNOWLEDGE ACADEMY
                            </h3>
                            <span className="text-xs text-amber-300 font-serif font-semibold">
                              (آنر نالج اکیڈمی)
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-medium tracking-wide">
                            OFFICIAL FEE PAYMENT RECEIPT & VOUCHER • SESSION 2026-2027
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-amber-500 text-slate-950 text-xs font-black uppercase px-3 py-1 rounded-lg tracking-wider shadow-xs">
                          Student Copy
                        </span>
                        <span className="bg-emerald-600 text-white text-xs font-bold uppercase px-2.5 py-1 rounded-lg shadow-xs flex items-center gap-1">
                          <i className="fa-solid fa-check-circle"></i>
                          <span>Status: PAID</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Voucher Body */}
                  <div className="p-6 space-y-5 bg-gradient-to-b from-white to-slate-50/40">
                    {/* Voucher Metadata Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Receipt No:</span>
                        <span className="font-mono font-bold text-gray-900">{receiptNo}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Billing Month:</span>
                        <span className="font-bold text-gray-900">{feeMonth}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Date Received:</span>
                        <span className="font-bold text-gray-900">{today}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">Payment Status:</span>
                        <span className="font-black text-emerald-700 uppercase flex items-center gap-1">
                          <i className="fa-solid fa-circle-check text-xs"></i>
                          <span>PAID & VERIFIED</span>
                        </span>
                      </div>
                    </div>

                    {/* Student Full Information Box */}
                    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-gray-500 font-semibold">Student Name:</span>
                          <span className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span>{student.name}</span>
                            {student.name_ur && (
                              <span className="text-xs text-indigo-700 font-serif">({student.name_ur})</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-gray-500 font-semibold">Roll / ID Number:</span>
                          <span className="font-mono font-bold text-indigo-700">{student.student_code}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-gray-500 font-semibold">Class / Batch:</span>
                          <span className="font-bold text-gray-800">
                            {student.class_room?.name || '—'} / {student.batch?.name || '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-gray-500 font-semibold">Guardian:</span>
                          <span className="font-bold text-gray-800">
                            {student.guardian_name || '—'}{' '}
                            {student.guardian_name_ur && (
                              <span className="text-gray-500 font-serif">({student.guardian_name_ur})</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-semibold">WhatsApp Number:</span>
                          <span className="font-bold text-emerald-700 flex items-center gap-1">
                            <i className="fa-brands fa-whatsapp text-sm"></i>
                            <span>{student.whatsapp_number}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-semibold">Payment Mode:</span>
                          <span className="font-semibold text-gray-800">Cash / Online</span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Table (Clean & Simple) */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-white font-bold uppercase text-[11px]">
                          <tr>
                            <th className="px-4 py-2.5 w-12">#</th>
                            <th className="px-4 py-2.5">Fee Description</th>
                            <th className="px-4 py-2.5">Billing Period / Remarks</th>
                            <th className="px-4 py-2.5 text-right">Amount Received (PKR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          <tr className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-gray-400 font-bold">01</td>
                            <td className="px-4 py-3 font-semibold text-gray-800">
                              Monthly Tuition Fee ({feeMonth})
                            </td>
                            <td className="px-4 py-3 text-gray-500">Regular Academy Tuition — Paid in Full</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                              PKR {tuitionNum.toLocaleString()}
                            </td>
                          </tr>

                          {/* TOTAL ROW */}
                          <tr className="bg-slate-900 text-white font-bold">
                            <td colSpan="2" className="px-4 py-3 text-sm">
                              <span className="uppercase tracking-wider">Total Fee Received</span>
                              <span className="ml-3 px-2 py-0.5 rounded-md text-[10px] bg-emerald-600 text-white uppercase font-black">
                                Status: PAID
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-amber-300 font-normal">
                              Paid in full & stamped
                            </td>
                            <td className="px-4 py-3 text-right text-base text-amber-400 font-black">
                              PKR {tuitionNum.toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* PREVIOUS FEE RECORDS & OFFICIAL RUBBER STAMP */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-2">
                      {/* Previous Fee Records Table */}
                      <div className="md:col-span-2">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                          <div className="font-bold text-slate-800 flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 uppercase tracking-wide text-slate-700">
                              <i className="fa-solid fa-clock-rotate-left text-indigo-600"></i>
                              <span>Previous Fee Payment Records / سابقہ فیس کی تفصیل</span>
                            </span>
                            <span className="text-[10px] text-gray-500 font-normal font-mono">
                              Total Recorded: {previousFeeRecords.length}
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead>
                                <tr className="text-gray-400 border-b border-gray-200">
                                  <th className="py-1">Month</th>
                                  <th className="py-1">Date Received</th>
                                  <th className="py-1">Receipt #</th>
                                  <th className="py-1 text-right">Amount</th>
                                  <th className="py-1 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {previousFeeRecords.slice(0, 3).map((rec, i) => (
                                  <tr key={i} className="text-gray-700">
                                    <td className="py-1 font-semibold">{rec.month}</td>
                                    <td className="py-1 text-gray-500">{rec.date}</td>
                                    <td className="py-1 font-mono text-gray-500">{rec.receipt}</td>
                                    <td className="py-1 text-right font-medium text-gray-800">
                                      PKR {Number(rec.amount).toLocaleString()}
                                    </td>
                                    <td className="py-1 text-right">
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                        PAID
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* AUTHENTIC "HONOR KNOWLEDGE ACADEMY" CIRCULAR PAID RUBBER STAMP */}
                      <div className="flex flex-col items-center justify-center relative py-2">
                        <div className="transform -rotate-6 select-none pointer-events-none transition-transform hover:rotate-0 duration-300">
                          <div className="w-32 h-32 rounded-full border-3 border-emerald-600 border-dashed p-1 flex items-center justify-center bg-emerald-50/40 shadow-xs">
                            <div className="w-full h-full rounded-full border-2 border-emerald-700 flex flex-col items-center justify-center text-center p-1 text-emerald-800 font-sans">
                              <span className="text-[7.5px] font-black tracking-wider uppercase text-emerald-700">
                                Honor Knowledge
                              </span>
                              <span className="text-[7px] font-black uppercase text-emerald-700 -mt-0.5">
                                Academy
                              </span>
                              <div className="w-20 h-0.5 bg-emerald-700 my-0.5"></div>
                              <span className="text-sm font-black tracking-widest text-emerald-700 uppercase drop-shadow-xs">
                                ★ PAID ★
                              </span>
                              <div className="w-20 h-0.5 bg-emerald-700 my-0.5"></div>
                              <span className="text-[6.5px] font-bold text-emerald-800 uppercase">
                                Verified & Recorded
                              </span>
                              <span className="text-[6px] font-mono text-emerald-700">{today}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-emerald-800 font-bold mt-1 tracking-wide">
                          Official Academy Paid Stamp
                        </span>
                      </div>
                    </div>

                    {/* Signatures Line */}
                    <div className="flex justify-between items-end pt-4 border-t border-slate-200 text-xs text-gray-500">
                      <div className="text-center">
                        <div className="w-36 border-b border-gray-300 mb-1"></div>
                        <span>Cashier / Accounts Officer</span>
                      </div>
                      <div className="text-[10px] text-gray-400 italic">
                        Computer-generated official fee voucher. Valid upon stamp verification.
                      </div>
                      <div className="text-center">
                        <div className="w-36 border-b border-gray-300 mb-1"></div>
                        <span>Authorized Signatory</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <i className="fa-solid fa-shield-halved text-emerald-600"></i>
                    <span>
                      Clicking <strong>Send via WhatsApp Desktop</strong> saves the PDF to Downloads and opens WhatsApp Desktop.
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Print Voucher */}
                    <button
                      type="button"
                      onClick={handlePrintPdf}
                      className="px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
                      title="Open printable voucher in browser"
                    >
                      <i className="fa-solid fa-print text-sm text-gray-500"></i>
                      <span>Print Voucher</span>
                    </button>

                    {/* Direct PDF Download */}
                    <button
                      type="button"
                      onClick={handleDownloadOnlyPdf}
                      className="px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center gap-2 shadow-xs transition-colors"
                      title="Download PDF directly to computer"
                    >
                      <i className="fa-solid fa-file-pdf text-sm text-indigo-600"></i>
                      <span>Download PDF Voucher</span>
                    </button>

                    {/* Primary: Send via WhatsApp Desktop */}
                    <button
                      type="button"
                      onClick={handleSendFeeReceipt}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2.5 shadow-md hover:shadow-lg transition-all"
                      title="Generate PDF and open WhatsApp Desktop"
                    >
                      <i className="fa-brands fa-whatsapp text-base"></i>
                      <span>Send Fee Receipt via WhatsApp Desktop</span>
                    </button>
                  </div>
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
