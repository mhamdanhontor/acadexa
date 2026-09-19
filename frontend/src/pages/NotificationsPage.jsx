import { useEffect, useState } from 'react'
import {
  listNotifications,
  retryNotification,
  markNotificationSent,
  dispatchPendingNotifications,
  listTemplates,
  updateTemplate,
} from '../api/notifications'
import { normalizeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { openWhatsApp } from '../utils/whatsapp'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'

export default function NotificationsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole('SUPER_ADMIN', 'ADMIN')

  const [tab, setTab] = useState('jobs') // 'jobs' | 'templates'

  const [jobs, setJobs] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 20

  const [templates, setTemplates] = useState([])
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateBody, setTemplateBody] = useState('')
  const [viewingJob, setViewingJob] = useState(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function loadJobs() {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter
      const data = await listNotifications(params)
      setJobs(Array.isArray(data) ? data : (data?.items || []))
      setTotal(data?.total ?? 0)
      setTotalPages(data?.total_pages ?? 1)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplates() {
    setLoading(true)
    setError(null)
    try {
      const data = await listTemplates()
      setTemplates(Array.isArray(data) ? data : (data?.items || []))
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'jobs') loadJobs()
    else loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, statusFilter, typeFilter])

  async function handleRetry(job) {
    try {
      await retryNotification(job.id)
      loadJobs()
    } catch (err) {
      setError(normalizeError(err).message)
    }
  }

  async function handleSendWhatsApp(job) {
    openWhatsApp(job.recipient, job.message)
    try {
      await markNotificationSent(job.id)
      loadJobs()
    } catch (err) {
      console.warn('Failed to mark sent on server:', err)
    }
  }

  const [dispatching, setDispatching] = useState(false)
  const [dispatchSuccess, setDispatchSuccess] = useState('')

  async function handleDispatchPending() {
    setDispatching(true)
    setError(null)
    setDispatchSuccess('')
    try {
      const res = await dispatchPendingNotifications()
      setDispatchSuccess(`Successfully processed ${res.processed} notification(s).`)
      loadJobs()
      setTimeout(() => setDispatchSuccess(''), 4000)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setDispatching(false)
    }
  }

  function openEditTemplate(tpl) {
    setEditingTemplate(tpl)
    setTemplateBody(tpl.body)
  }

  async function handleSaveTemplate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateTemplate(editingTemplate.id, { body: templateBody, is_active: editingTemplate.is_active })
      setEditingTemplate(null)
      loadTemplates()
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="WhatsApp notification jobs and message templates" />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setTab('jobs'); setPage(1) }}
          className={`text-sm font-medium px-4 py-2 rounded-md ${tab === 'jobs' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Notification Jobs
        </button>
        <button
          onClick={() => setTab('templates')}
          className={`text-sm font-medium px-4 py-2 rounded-md ${tab === 'templates' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Templates
        </button>
      </div>

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={tab === 'jobs' ? loadJobs : loadTemplates} /></div>}

      {tab === 'jobs' ? (
        <>
          {dispatchSuccess && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-circle-check"></i>
              <span>{dispatchSuccess}</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex flex-wrap items-center gap-3">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="RETRYING">Retrying</option>
            </select>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">All Types</option>
              <option value="ABSENCE">Absence</option>
              <option value="MARKS">Marks</option>
              <option value="MONTHLY_REPORT">Monthly Report</option>
            </select>
            {canManage && (
              <button
                type="button"
                onClick={handleDispatchPending}
                disabled={dispatching}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-md flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Process all pending notification jobs"
              >
                <i className="fas fa-paper-plane"></i>
                {dispatching ? 'Dispatching...' : 'Dispatch All Pending'}
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : (jobs || []).length === 0 ? (
              <EmptyState title="No notification jobs" icon="fa-comment-dots" />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Student</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Recipient</th>
                    <th className="px-5 py-3 font-medium">Message</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Retries</th>
                    <th className="px-5 py-3 font-medium">Failure Reason</th>
                    {canManage && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(jobs || []).map((j) => (
                    <tr key={j.id}>
                      <td className="px-5 py-3 text-gray-600">#{j.student_id}</td>
                      <td className="px-5 py-3 text-gray-600">{j.type.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{j.recipient}</td>
                      <td className="px-5 py-3 text-gray-600 max-w-xs">
                        <div
                          onClick={() => setViewingJob(j)}
                          className="truncate text-xs cursor-pointer hover:text-indigo-600 underline decoration-dotted"
                          title="Click to view full message"
                        >
                          {j.message}
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={j.status} /></td>
                      <td className="px-5 py-3 text-gray-600">{j.retry_count}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs max-w-xs truncate">{j.failure_reason || '—'}</td>
                      {canManage && (
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSendWhatsApp(j)}
                              title="Send via Admin WhatsApp Web"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#25D366] hover:bg-[#20ba5a] text-white transition-colors shadow-xs"
                            >
                              <i className="fab fa-whatsapp"></i>
                              Send
                            </button>
                            {j.status === 'FAILED' && (
                              <button onClick={() => handleRetry(j)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                Retry
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Body</th>
                  <th className="px-5 py-3 font-medium">Active</th>
                  {canManage && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3 text-gray-600">{t.type.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{t.name}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-md truncate">{t.body}</td>
                    <td className="px-5 py-3"><StatusBadge status={t.is_active} /></td>
                    {canManage && (
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => openEditTemplate(t)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal open={!!editingTemplate} title="Edit Template" onClose={() => setEditingTemplate(null)} width="max-w-lg">
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
            <textarea
              rows={5}
              value={templateBody}
              onChange={(e) => setTemplateBody(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Supports placeholders like {'{'}{'{'}student_name{'}'}{'}'}, {'{'}{'{'}date{'}'}{'}'}, {'{'}{'{'}subject{'}'}{'}'}, {'{'}{'{'}marks{'}'}{'}'} depending on type.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditingTemplate(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={!!viewingJob} title="Notification Message" onClose={() => setViewingJob(null)} width="max-w-md">
        {viewingJob && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500">
              Recipient: <strong className="text-gray-700 font-mono">{viewingJob.recipient}</strong> (Student #{viewingJob.student_id})
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 font-sans leading-relaxed whitespace-pre-wrap">
              {viewingJob.message}
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewingJob.message)
                }}
                className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-50 flex items-center gap-1.5"
              >
                <i className="fas fa-copy"></i>
                Copy Message
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingJob(null)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSendWhatsApp(viewingJob)
                    setViewingJob(null)
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20ba5a] rounded-md flex items-center gap-1.5 shadow-xs"
                >
                  <i className="fab fa-whatsapp"></i>
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
