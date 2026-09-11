import { useEffect, useState } from 'react'
import { listReports, generateReports, approveReport, sendReport, downloadReportPath } from '../api/reports'
import { listClasses, listBatches } from '../api/academicStructure'
import { normalizeError, downloadFile } from '../api/client'
import { useAuth } from '../context/AuthContext'
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

  const [genModalOpen, setGenModalOpen] = useState(false)
  const [genForm, setGenForm] = useState({ period_start: '', period_end: '', class_id: '', batch_id: '' })
  const [generating, setGenerating] = useState(false)

  const [confirmSend, setConfirmSend] = useState(null) // report object

  async function loadLookups() {
    try {
      const [c, b] = await Promise.all([listClasses({ page_size: 100 }), listBatches({ page_size: 100 })])
      setClasses(c.items)
      setBatches(b.items)
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      const data = await listReports(params)
      setReports(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLookups()
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
      await generateReports(payload)
      setGenModalOpen(false)
      setGenForm({ period_start: '', period_end: '', class_id: '', batch_id: '' })
      load()
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
    } catch (err) {
      setActionError(normalizeError(err).message)
    }
  }

  async function handleSend(report) {
    setActionError('')
    try {
      await sendReport(report.id)
      setConfirmSend(null)
      load()
    } catch (err) {
      setActionError(normalizeError(err).message)
      setConfirmSend(null)
    }
  }

  async function handleDownload(report) {
    setActionError('')
    try {
      await downloadFile(downloadReportPath(report.id), `report_${report.id}.pdf`)
    } catch (err) {
      setActionError(normalizeError(err).message)
    }
  }

  const className = (id) => classes.find((c) => c.id === id)?.name || 'All'
  const batchName = (id) => batches.find((b) => b.id === id)?.name || 'All'

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Generate, approve, and send monthly attendance reports"
        actions={
          canManage && (
            <button onClick={() => setGenModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md">
              <i className="fas fa-plus mr-2"></i>Generate Reports
            </button>
          )
        }
      />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}
      {actionError && <div className="mb-4"><ErrorAlert message={actionError} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="READY">Ready</option>
          <option value="APPROVED">Approved</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : reports.length === 0 ? (
          <EmptyState title="No reports yet" subtitle="Generate reports for a period to get started." icon="fa-chart-column" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Student ID</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Class / Batch</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-gray-600">{r.student_id ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{r.period_start} → {r.period_end}</td>
                  <td className="px-5 py-3 text-gray-600">{className(r.class_id)} / {batchName(r.batch_id)}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-right space-x-3">
                    {r.file_path && (
                      <button onClick={() => handleDownload(r)} className="text-indigo-600 hover:text-indigo-800">
                        Download
                      </button>
                    )}
                    {canManage && (r.status === 'DRAFT' || r.status === 'READY') && (
                      <button onClick={() => handleApprove(r, true)} className="text-green-600 hover:text-green-800">
                        Approve
                      </button>
                    )}
                    {canManage && r.status === 'APPROVED' && (
                      <button onClick={() => setConfirmSend(r)} className="text-blue-600 hover:text-blue-800">
                        Send
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <Modal open={genModalOpen} title="Generate Monthly Reports" onClose={() => setGenModalOpen(false)}>
        <form onSubmit={handleGenerate} className="space-y-4">
          {actionError && <ErrorAlert message={actionError} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input required type="date" value={genForm.period_start} onChange={(e) => setGenForm({ ...genForm, period_start: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input required type="date" value={genForm.period_end} onChange={(e) => setGenForm({ ...genForm, period_end: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class (optional)</label>
              <select value={genForm.class_id} onChange={(e) => setGenForm({ ...genForm, class_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">All Classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch (optional)</label>
              <select value={genForm.batch_id} onChange={(e) => setGenForm({ ...genForm, batch_id: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">All Batches</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">Generates one report per matching student in status READY. Already APPROVED/SENT reports for the period are not overwritten.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setGenModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={generating} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmSend}
        title="Send Report"
        message={`This will queue a WhatsApp notification to send the approved report for student #${confirmSend?.student_id}. This action cannot be undone. Continue?`}
        confirmLabel="Send"
        onConfirm={() => handleSend(confirmSend)}
        onCancel={() => setConfirmSend(null)}
      />
    </div>
  )
}
