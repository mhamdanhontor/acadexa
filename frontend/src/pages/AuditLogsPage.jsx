import { useEffect, useState } from 'react'
import { listAuditLogs } from '../api/misc'
import { normalizeError } from '../api/client'
import PageHeader from '../components/PageHeader'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 30

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = { page, page_size: pageSize }
      if (entityFilter) params.entity = entityFilter
      if (actionFilter) params.action = actionFilter
      const data = await listAuditLogs(params)
      setLogs(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err) {
      setError(normalizeError(err).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, entityFilter, actionFilter])

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Read-only trail of all administrative actions" />

      {error && <div className="mb-4"><ErrorAlert message={error} onRetry={load} /></div>}

      <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4 flex flex-wrap gap-3">
        <input
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1) }}
          placeholder="Filter by entity (e.g. student, attendance)"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm min-w-[220px]"
        />
        <input
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          placeholder="Filter by action (e.g. STUDENT_CREATED)"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm min-w-[220px]"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : logs.length === 0 ? (
          <EmptyState title="No audit log entries" icon="fa-clipboard-list" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Entity</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">User ID</th>
                <th className="px-5 py-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-3 font-medium text-gray-800">{l.action.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-gray-600">{l.entity}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-md truncate">{l.description || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{l.user_id ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </div>
  )
}
