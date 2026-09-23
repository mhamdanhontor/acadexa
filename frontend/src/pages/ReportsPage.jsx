import { useEffect, useState } from 'react'
import {
  listReports,
  generateReports,
  approveReport,
  sendReport,
  approveAndSendReport,
  approveAndSendAllReports,
  getMonthEndReminder,
  downloadReportPath,
} from '../api/reports'
import { listClasses, listBatches } from '../api/academicStructure'
import { normalizeError, downloadFile } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { openWhatsApp, getStoredWhatsAppTarget, setStoredWhatsAppTarget } from '../utils/whatsapp'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'

export default function ReportsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [reports, setReports] = useState([])
  const [classes, setClasses] = useState([])
  const [batches, setBatches] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [reminder, setReminder] = useState(null)

  const [genModalOpen, setGenModalOpen] = useState(false)
  const [genForm, setGenForm] = useState({ period_start: '', period_end: '', class_id: '', batch_id: '' })
  const [generating, setGenerating] = useState(false)

  const [waTarget, setWaTarget] = useState(getStoredWhatsAppTarget() || 'desktop')

  function handleWaTargetChange(newTarget) {
    setWaTarget(newTarget)
    setStoredWhatsAppTarget(newTarget)
  }

  const [confirmSend, setConfirmSend] = useState(null) // report object
  const [confirmApproveAndSend, setConfirmApproveAndSend] = useState(null) // report object
  const [confirmBulkSend, setConfirmBulkSend] = useState(false)
  const [bulkSending, setBulkSending] = useState(false)

  async function loadLookups() {
    try {
      const [c, b] = await Promise.all([listClasses({ page_size: 100 }), listBatches({ page_size: 100 })])
      setClasses(Array.isArray(c) ? c : (c?.items || []))
      setBatches(Array.isArray(b) ? b : (b?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  async function loadReminder() {
    try {
      const data = await getMonthEndReminder()
      setReminder(data)
    } catch (err) {
      console.warn('Failed to load month-end reminder:', err)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      const data = await listReports(params)
      setReports(Array.isArray(data) ? data : (data?.items || []))
      setTotal(data?.total ?? 0)
      setTotalPages(data?.total_pages ?? 1)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
    loadReminder()
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter])

  async function handleGenerate(e) {
    e.preventDefault()
    setGenerating(true)
    setActionError('')
    try {
      const payload = {
        period_start: genForm.period_start,
        period_end: genForm.period_end,
        class_id: genForm.class_id ? Number(genForm.class_id) : null,
        batch_id: genForm.batch_id ? Number(genForm.batch_id) : null,
      }
      const res = await generateReports(payload)
      setGenModalOpen(false)
      setGenForm({ period_start: '', period_end: '', class_id: '', batch_id: '' })
      setSuccessMsg(`Generated ${res.length} report(s) successfully.`)
      setTimeout(() => setSuccessMsg(''), 4000)
      load()
      loadReminder()
    } catch (err) {
      setActionError(normalizeError(err).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleApprove(report, approve) {
    setActionError('')
    try {
      await approveReport(report.id, approve)
      load()
      loadReminder()
    } catch (err) {
      setActionError(normalizeError(err).message)
    }
  }

  async function handleSend(report, targetOverride) {
    const target = targetOverride || waTarget || 'desktop'
    setActionError('')
    try {
      await sendReport(report.id)
      setConfirmSend(null)
      const targetLabel = target === 'web' ? 'WhatsApp Web' : target === 'universal' ? 'wa.me Direct' : 'WhatsApp Desktop'
      setSuccessMsg(`Report #${report.id} sent! Downloading PDF and opening ${targetLabel}...`)
      setTimeout(() => setSuccessMsg(''), 5000)

      // 1. Download PDF report
      try {
        await handleDownload(report)
      } catch (dlErr) {
        console.warn('PDF download failed:', dlErr)
      }

      // 2. Open WhatsApp
      if (report.whatsapp_number) {
        handleOpenWhatsAppDirect(report, target)
      }

      load()
      loadReminder()
    } catch (err) {
      setActionError(normalizeError(err).message)
      setConfirmSend(null)
    }
  }

  async function handleApproveAndSend(report, targetOverride) {
    const target = targetOverride || waTarget || 'desktop'
    setActionError('')
    try {
      await approveAndSendReport(report.id)
      setConfirmApproveAndSend(null)
      const targetLabel = target === 'web' ? 'WhatsApp Web' : target === 'universal' ? 'wa.me Direct' : 'WhatsApp Desktop'
      setSuccessMsg(`Report for ${report.student_name || 'student'} approved & sent! Downloading PDF and opening ${targetLabel}...`)
      setTimeout(() => setSuccessMsg(''), 5000)

      // 1. Download PDF report
      try {
        await handleDownload(report)
      } catch (dlErr) {
        console.warn('PDF auto-download failed:', dlErr)
      }

      // 2. Open WhatsApp directly with student report message
      if (report.whatsapp_number) {
        handleOpenWhatsAppDirect(report, target)
      }

      load()
      loadReminder()
    } catch (err) {
      setActionError(normalizeError(err).message)
      setConfirmApproveAndSend(null)
    }
  }

  async function handleBulkApproveAndSend() {
    setBulkSending(true)
    setActionError('')
    try {
      const res = await approveAndSendAllReports()
      setConfirmBulkSend(false)
      setSuccessMsg(`Successfully approved and queued ${res.length} report(s) for WhatsApp delivery!`)
      setTimeout(() => setSuccessMsg(''), 4000)
      load()
      loadReminder()
    } catch (err) {
      setActionError(normalizeError(err).message)
    } finally {
      setBulkSending(false)
    }
  }

  async function handleDownload(report) {
    setActionError('')
    try {
      await downloadFile(downloadReportPath(report.id), `monthly_report_${report.student_code || report.id}.pdf`)
    } catch (err) {
      setActionError(normalizeError(err).message)
      throw err
    }
  }

  function handleOpenWhatsAppDirect(report, targetOverride) {
    if (!report.whatsapp_number) {
      setActionError(`Student ${report.student_name || 'student'} does not have a registered WhatsApp number.`)
      return
    }
    const target = targetOverride || waTarget || 'desktop'

    let attSummary = ''
    let testSummary = ''
    let attSummaryUr = ''
    let testSummaryUr = ''
    let studentUr = report.student_name || ''
    let guardianUr = report.guardian_name || ''

    try {
      if (report.data_json) {
        const d = typeof report.data_json === 'string' ? JSON.parse(report.data_json) : report.data_json
        if (d.student_name_ur) studentUr = d.student_name_ur
        if (d.guardian_name_ur) guardianUr = d.guardian_name_ur

        if (d.attendance) {
          attSummary = `\n📊 *Monthly Attendance:* *${d.attendance.percentage}%* (${d.attendance.present || 0} Present, ${d.attendance.late || 0} Late, ${d.attendance.absent || 0} Absent)`
          attSummaryUr = `\n📊 *ماہانہ حاضری:* *${d.attendance.percentage}%* (${d.attendance.present || 0} حاضر، ${d.attendance.late || 0} تاخیر، ${d.attendance.absent || 0} غیر حاضر)`
        }
        if (d.academics && d.academics.total_tests > 0) {
          testSummary = `\n📝 *Tests & Marks:* ${d.academics.total_tests} Tests Conducted | Avg Score: *${d.academics.overall_percentage}%* | Grade: *${d.academics.overall_grade}*`
          testSummaryUr = `\n📝 *امتحانی نتائج:* ${d.academics.total_tests} ٹیسٹ | اوسط: *${d.academics.overall_percentage}%* | گریڈ: *${d.academics.overall_grade}*`
        }
      }
    } catch (e) {
      console.warn('Failed to parse report data_json for WhatsApp msg:', e)
    }

    if (!guardianUr || guardianUr.trim().toLowerCase() === 'nill' || guardianUr === 'نیلل' || guardianUr.trim().toLowerCase() === 'none') {
      guardianUr = 'محترم والدین / سرپرست'
    }

    const guardLineUr =
      guardianUr === 'محترم والدین / سرپرست'
        ? 'محترم والدین / سرپرست،'
        : `محترم والدین / سرپرست (*${guardianUr}*)،`

    const msg =
      `*MONTHLY PROGRESS REPORT*\n` +
      `Student: *${report.student_name}* (${report.student_code || `#${report.student_id}`})\n` +
      `Period: *${report.period_start} to ${report.period_end}*\n` +
      `Class: *${report.class_name || className(report.class_id)}* | Batch: *${report.batch_name || batchName(report.batch_id)}*\n` +
      attSummary +
      testSummary +
      `\n\nYour child's official monthly academic and attendance report has been generated. The detailed PDF report is downloaded and ready for review.\n\n` +
      `*Honor Knowledge Academy*\n\n` +
      `-----------------------------------\n\n` +
      `*ماہانہ تعلیمی و حاضری رپورٹ*\n*السلام علیکم*\n\n` +
      `${guardLineUr}\n\n` +
      `طالب علم: *${studentUr}* (${report.student_code || `#${report.student_id}`})\n` +
      `دورانیہ: *${report.period_start} تا ${report.period_end}*\n` +
      `کلاس: *${report.class_name || className(report.class_id)}* | بیج: *${report.batch_name || batchName(report.batch_id)}*\n` +
      attSummaryUr +
      testSummaryUr +
      `\n\nآپ کے بچے کی سرکاری ماہانہ تعلیمی و حاضری رپورٹ تیار کر لی گئی ہے۔ تفصیلی پی ڈی ایف رپورٹ ڈاؤن لوڈ ہو چکی ہے۔\n\n` +
      `والسلام،\n` +
      `*آنر نالج اکیڈمی*`

    openWhatsApp(report.whatsapp_number, msg, target)
  }

  const className = (id) => (classes || []).find((c) => c.id === id)?.name || 'All Classes'
  const batchName = (id) => (batches || []).find((b) => b.id === id)?.name || 'All Batches'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly Reports"
        subtitle="Generate, review, approve, and send student attendance & test performance reports"
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmBulkSend(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Approve and send all ready monthly reports via WhatsApp"
              >
                <i className="fas fa-paper-plane"></i>
                Approve & Send All
              </button>
              <button
                type="button"
                onClick={() => setGenModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <i className="fas fa-plus"></i>
                Generate Reports
              </button>
            </div>
          )
        }
      />

      {/* Month-End Reminder Banner */}
      {reminder && reminder.is_reminder_active && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shrink-0">
              <i className="fas fa-bell"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full">
                  Month-End Report Reminder
                </span>
                <span className="text-xs text-amber-100 font-medium">
                  {reminder.days_remaining === 0 ? 'Final day of the month' : `${reminder.days_remaining} day(s) remaining`}
                </span>
              </div>
              <p className="text-sm font-semibold text-white/95">
                {reminder.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setGenForm({
                  period_start: reminder.period_start,
                  period_end: reminder.period_end,
                  class_id: '',
                  batch_id: '',
                })
                setGenModalOpen(true)
              }}
              className="bg-white hover:bg-amber-50 text-amber-900 text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <i className="fas fa-plus mr-1.5"></i>
              Generate {reminder.month_name}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setConfirmBulkSend(true)}
                className="bg-black/25 hover:bg-black/35 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-white/20 transition-colors cursor-pointer"
              >
                <i className="fas fa-paper-plane mr-1.5"></i>
                Approve & Send All
              </button>
            )}
          </div>
        </div>
      )}

      {error && <ErrorAlert message={error} onRetry={load} />}
      {actionError && <ErrorAlert message={actionError} />}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm flex items-center gap-2 shadow-xs">
          <i className="fas fa-circle-check"></i>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="READY">Ready for Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (reports || []).length === 0 ? (
          <EmptyState
            title="No reports generated yet"
            subtitle="Generate monthly reports for any class or period to get started."
            icon="fa-chart-column"
            action={
              canManage && (
                <button
                  type="button"
                  onClick={() => setGenModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg mt-2 cursor-pointer"
                >
                  <i className="fas fa-plus mr-1.5"></i>
                  Generate Reports
                </button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-gray-500 text-left border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 font-semibold">Student ID</th>
                  <th className="px-5 py-3 font-semibold">Student Name</th>
                  <th className="px-5 py-3 font-semibold">Class & Batch</th>
                  <th className="px-5 py-3 font-semibold">Period</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(reports || []).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-700">
                      {r.student_code || `#${r.student_id}`}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {r.student_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      <span className="font-medium text-gray-800">{r.class_name || className(r.class_id)}</span>
                      <span className="text-gray-400 mx-1.5">/</span>
                      <span className="text-gray-600">{r.batch_name || batchName(r.batch_id)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">
                      {r.period_start} → {r.period_end}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {/* Download PDF button */}
                      <button
                        type="button"
                        onClick={() => handleDownload(r)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer border border-indigo-200"
                        title="Download / View Official PDF Report"
                      >
                        <i className="fas fa-file-pdf text-red-500"></i>
                        PDF
                      </button>

                      {/* WhatsApp Desktop Button */}
                      {r.whatsapp_number && (
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppDirect(r, 'desktop')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
                          title="Open directly in WhatsApp Desktop App"
                        >
                          <i className="fab fa-whatsapp text-emerald-600"></i>
                          WhatsApp Desktop
                        </button>
                      )}

                      {/* WhatsApp Web Button */}
                      {r.whatsapp_number && (
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppDirect(r, 'web')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 px-1.5 py-1 rounded bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                          title="Open in WhatsApp Web (Browser)"
                        >
                          <i className="fas fa-globe text-gray-500"></i>
                          Web
                        </button>
                      )}

                      {/* Approve & Send (Single Click) */}
                      {canManage && (r.status === 'DRAFT' || r.status === 'READY') && (
                        <button
                          type="button"
                          onClick={() => setConfirmApproveAndSend(r)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer"
                          title="Approve and send report to WhatsApp immediately"
                        >
                          <i className="fas fa-paper-plane"></i>
                          Approve & Send
                        </button>
                      )}

                      {/* Step 1: Approve only */}
                      {canManage && (r.status === 'DRAFT' || r.status === 'READY') && (
                        <button
                          type="button"
                          onClick={() => handleApprove(r, true)}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors cursor-pointer px-1 py-1"
                        >
                          Approve
                        </button>
                      )}

                      {/* Step 2: Send if approved */}
                      {canManage && r.status === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => setConfirmSend(r)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded shadow-2xs transition-colors cursor-pointer"
                        >
                          <i className="fas fa-paper-plane"></i>
                          Send
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {/* Modal: Generate Reports */}
      <Modal open={genModalOpen} title="Generate Monthly Reports" onClose={() => setGenModalOpen(false)}>
        <form onSubmit={handleGenerate} className="space-y-4">
          {actionError && <ErrorAlert message={actionError} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input
                required
                type="date"
                value={genForm.period_start}
                onChange={(e) => setGenForm({ ...genForm, period_start: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input
                required
                type="date"
                value={genForm.period_end}
                onChange={(e) => setGenForm({ ...genForm, period_end: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
              <select
                value={genForm.class_id}
                onChange={(e) => setGenForm({ ...genForm, class_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch (optional)</label>
              <select
                value={genForm.batch_id}
                onChange={(e) => setGenForm({ ...genForm, batch_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <i className="fas fa-info-circle mr-1 text-indigo-600"></i>
            Generates one report per matching student in status <strong>READY</strong> with complete monthly attendance
            and all test marks. Already APPROVED or SENT reports will not be overwritten.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setGenModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60 cursor-pointer"
            >
              {generating ? 'Generating...' : 'Generate Reports'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Send */}
      {confirmSend && (
        <Modal
          open={!!confirmSend}
          title="Send Monthly Report via WhatsApp"
          onClose={() => setConfirmSend(null)}
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2.5">
              <i className="fab fa-whatsapp text-emerald-600 text-lg mt-0.5 shrink-0"></i>
              <div>
                <p className="font-semibold text-blue-950">
                  {confirmSend.student_name} ({confirmSend.student_code || `#${confirmSend.student_id}`})
                </p>
                <p className="text-xs text-blue-800 mt-0.5">
                  Guardian: <strong>{confirmSend.guardian_name || 'Parent/Guardian'}</strong> · WhatsApp: <strong>{confirmSend.whatsapp_number || 'No phone'}</strong>
                </p>
                <p className="text-xs text-blue-700 mt-1 font-mono">
                  Period: {confirmSend.period_start} → {confirmSend.period_end}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Choose WhatsApp Dispatch Option:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleWaTargetChange('desktop')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    waTarget === 'desktop'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                    <i className="fab fa-whatsapp text-emerald-600"></i>
                    Desktop App
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Direct to WhatsApp Desktop (Recommended)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleWaTargetChange('web')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    waTarget === 'web'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                    <i className="fas fa-globe text-indigo-600"></i>
                    WhatsApp Web
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Opens web.whatsapp.com in browser</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleWaTargetChange('universal')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    waTarget === 'universal'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                    <i className="fas fa-link text-blue-600"></i>
                    wa.me Direct
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Universal web/mobile direct link</p>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="flex items-center gap-1.5 text-gray-700 font-medium">
                <i className="fas fa-info-circle text-indigo-600"></i>
                Action Summary:
              </p>
              <p>• The official colorful progress report <strong>PDF is downloaded</strong> to your PC.</p>
              <p>• WhatsApp will open with the complete student score summary pre-filled.</p>
              <p>• Report status will be marked as <strong>SENT</strong>.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSend(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSend(confirmSend)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <i className="fas fa-paper-plane"></i>
                Send via {waTarget === 'desktop' ? 'WhatsApp Desktop' : waTarget === 'web' ? 'WhatsApp Web' : 'wa.me'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Confirm Approve & Send */}
      {confirmApproveAndSend && (
        <Modal
          open={!!confirmApproveAndSend}
          title="Approve & Send Monthly Report"
          onClose={() => setConfirmApproveAndSend(null)}
        >
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900 flex items-start gap-2.5">
              <i className="fab fa-whatsapp text-emerald-600 text-lg mt-0.5 shrink-0"></i>
              <div>
                <p className="font-semibold text-emerald-950">
                  {confirmApproveAndSend.student_name} ({confirmApproveAndSend.student_code || `#${confirmApproveAndSend.student_id}`})
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Guardian: <strong>{confirmApproveAndSend.guardian_name || 'Parent/Guardian'}</strong> · WhatsApp: <strong>{confirmApproveAndSend.whatsapp_number || 'No phone'}</strong>
                </p>
                <p className="text-xs text-emerald-700 mt-1 font-mono">
                  Period: {confirmApproveAndSend.period_start} → {confirmApproveAndSend.period_end}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                Choose WhatsApp Dispatch Option:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleWaTargetChange('desktop')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    waTarget === 'desktop'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                    <i className="fab fa-whatsapp text-emerald-600"></i>
                    Desktop App
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Direct to WhatsApp Desktop (Recommended)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleWaTargetChange('web')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    waTarget === 'web'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                    <i className="fas fa-globe text-indigo-600"></i>
                    WhatsApp Web
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Opens web.whatsapp.com in browser</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleWaTargetChange('universal')}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    waTarget === 'universal'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-gray-900">
                    <i className="fas fa-link text-blue-600"></i>
                    wa.me Direct
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Universal web/mobile direct link</p>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="flex items-center gap-1.5 text-gray-700 font-medium">
                <i className="fas fa-info-circle text-emerald-600"></i>
                Action Summary:
              </p>
              <p>• Report status will be approved and marked as <strong>SENT</strong>.</p>
              <p>• The official colorful progress report <strong>PDF is downloaded</strong> to your PC.</p>
              <p>• WhatsApp will open with the complete student score summary pre-filled.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmApproveAndSend(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApproveAndSend(confirmApproveAndSend)}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <i className="fas fa-paper-plane"></i>
                Approve & Send via {waTarget === 'desktop' ? 'WhatsApp Desktop' : waTarget === 'web' ? 'WhatsApp Web' : 'wa.me'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Bulk Approve & Send All */}
      <ConfirmDialog
        open={confirmBulkSend}
        title="Approve & Send All Reports"
        message="Are you sure you want to approve and send all generated monthly reports via WhatsApp? Each student's guardian will receive their monthly attendance and test performance summary."
        confirmLabel={bulkSending ? 'Processing...' : 'Approve & Send All'}
        onConfirm={handleBulkApproveAndSend}
        onCancel={() => setConfirmBulkSend(false)}
      />
    </div>
  )
}
