import { useState } from 'react'
import Modal from './Modal'
import { openWhatsApp, cleanPhoneNumber } from '../utils/whatsapp'
import { markNotificationSent } from '../api/notifications'

export default function AbsenceWhatsAppModal({
  open,
  onClose,
  absentees = [],
  sessionDate = '',
  className = '',
  batchName = '',
}) {
  // Target: 'web' | 'desktop'
  const [target, setTarget] = useState('web')
  // Track status per student_id: 'PENDING' | 'SENT'
  const [sentMap, setSentMap] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // Initialize or merge statuses
  const items = absentees.map((item) => ({
    ...item,
    currentStatus: sentMap[item.student_id] || (item.status === 'SENT' ? 'SENT' : 'PENDING'),
  }))

  const sentCount = items.filter((i) => i.currentStatus === 'SENT').length
  const totalCount = items.length

  async function handleSend(item) {
    // 1. Open WhatsApp
    openWhatsApp(item.whatsapp_number, item.message, target)

    // 2. Update local state
    setSentMap((prev) => ({ ...prev, [item.student_id]: 'SENT' }))

    // 3. Mark sent on backend if notification_id exists
    if (item.notification_id) {
      try {
        await markNotificationSent(item.notification_id)
      } catch (err) {
        console.warn('Failed to mark notification sent on server:', err)
      }
    }
  }

  async function handleSendNext() {
    const nextItem = items.find((i) => i.currentStatus !== 'SENT')
    if (nextItem) {
      await handleSend(nextItem)
    }
  }

  function handleCopyMessage(id, text) {
    navigator.clipboard.writeText(text || '')
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleCopyAll() {
    const text = items
      .map(
        (i, idx) =>
          `${idx + 1}. ${i.student_name} (${i.student_code})\nGuardian: ${i.guardian_name} (${i.whatsapp_number})\nMessage: ${i.message}`
      )
      .join('\n\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2500)
  }

  if (!open) return null

  return (
    <Modal open={open} onClose={onClose} title="WhatsApp Absence Dispatch" width="max-w-3xl">
      <div className="space-y-4">
        {/* Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 text-xl shadow-sm">
            <i className="fab fa-whatsapp"></i>
          </div>
          <div className="flex-1 text-sm text-emerald-950">
            <h4 className="font-semibold text-emerald-900 mb-0.5">
              Send Absence Alerts from Admin WhatsApp
            </h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Clicking <strong>Send via WhatsApp</strong> opens the parent's chat directly in your active WhatsApp session with the absence message ready. Simply hit Enter to send.
            </p>
          </div>
        </div>

        {/* Dispatch Controls & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Open In:
            </span>
            <div className="inline-flex rounded-md shadow-xs bg-white border border-gray-300 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTarget('web')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  target === 'web'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <i className="fas fa-globe mr-1.5"></i>WhatsApp Web
              </button>
              <button
                type="button"
                onClick={() => setTarget('desktop')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  target === 'desktop'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <i className="fab fa-windows mr-1.5"></i>Desktop App
              </button>
              <button
                type="button"
                onClick={() => setTarget('universal')}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  target === 'universal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <i className="fas fa-link mr-1.5"></i>wa.me Direct
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 font-medium">
              Progress: <strong className="text-indigo-600">{sentCount}</strong> / {totalCount} sent
            </span>

            {totalCount > 0 && sentCount < totalCount && (
              <button
                type="button"
                onClick={handleSendNext}
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold px-3 py-1.5 rounded shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <i className="fas fa-paper-plane text-xs"></i>
                Send Next Absentee
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyAll}
              className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2.5 py-1 bg-white hover:bg-gray-100 transition-colors flex items-center gap-1"
            >
              <i className="fas fa-copy"></i>
              {copiedAll ? 'Copied All!' : 'Copy All'}
            </button>
          </div>
        </div>

        {/* Absentees List */}
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-[380px] overflow-y-auto bg-white">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
              <p>No absent students to notify for this session.</p>
            </div>
          ) : (
            items.map((item, idx) => {
              const isSent = item.currentStatus === 'SENT'
              const cleanPhone = cleanPhoneNumber(item.whatsapp_number)

              return (
                <div
                  key={item.student_id || idx}
                  className={`p-3.5 transition-colors ${
                    isSent ? 'bg-green-50/40' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900 text-sm">
                          {item.student_name}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">
                          {item.student_code}
                        </span>
                        <span className="text-xs text-gray-500">
                          Guardian: <strong className="text-gray-700">{item.guardian_name}</strong>
                        </span>
                        <span className="text-xs text-emerald-700 font-mono flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          <i className="fab fa-whatsapp text-emerald-600"></i>
                          +{cleanPhone || item.whatsapp_number}
                        </span>
                      </div>

                      {/* Rendered Message Preview */}
                      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2 mt-1.5 font-sans leading-relaxed">
                        <span className="text-gray-400 select-none mr-1 font-serif text-sm">“</span>
                        {item.message}
                        <span className="text-gray-400 select-none ml-1 font-serif text-sm">”</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleSend(item)}
                        className={`text-xs font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all shadow-xs ${
                          isSent
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                            : 'bg-[#25D366] hover:bg-[#20ba5a] text-white'
                        }`}
                      >
                        <i className={`fab fa-whatsapp ${isSent ? 'text-emerald-700' : 'text-white'}`}></i>
                        {isSent ? 'Send Again' : 'Send via WhatsApp'}
                      </button>

                      <div className="flex items-center gap-2">
                        {isSent ? (
                          <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                            <i className="fas fa-circle-check text-emerald-600"></i>
                            Sent
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
                            <i className="fas fa-clock text-amber-500"></i>
                            Pending
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyMessage(item.student_id, item.message)}
                          title="Copy text"
                          className="text-[11px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          {copiedId === item.student_id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs text-gray-500">
          <span>
            {sessionDate && `Date: ${sessionDate}`}
            {className && ` · ${className}`}
            {batchName && ` (${batchName})`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors"
          >
            {sentCount === totalCount && totalCount > 0 ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
