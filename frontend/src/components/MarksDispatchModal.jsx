import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import { openWhatsApp, cleanPhoneNumber, getStoredWhatsAppTarget, setStoredWhatsAppTarget } from '../utils/whatsapp'
import { markNotificationSent } from '../api/notifications'

export default function MarksDispatchModal({
  open,
  onClose,
  dispatches = [],
  testName = 'Test / Exam',
  subject = '',
  autoSendFirst = false,
}) {
  // Target options: 'web' | 'desktop' | 'universal' (defaults to 'desktop')
  const [target, setTarget] = useState(getStoredWhatsAppTarget() || 'desktop')
  const [sentMap, setSentMap] = useState({})
  const [copiedId, setCopiedId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // Auto-dispatch pacing state (10s delay)
  const [autoRunning, setAutoRunning] = useState(false)
  const [countdown, setCountdown] = useState(10)
  const [pendingTargetItem, setPendingTargetItem] = useState(null)
  const timerRef = useRef(null)
  const autoSentRef = useRef(false)

  // Items mapped with current status
  const items = dispatches.map((item) => ({
    ...item,
    currentStatus: sentMap[item.student_id] || (item.status === 'SENT' ? 'SENT' : 'PENDING'),
  }))

  const sentCount = items.filter((i) => i.currentStatus === 'SENT').length
  const totalCount = items.length
  const pendingItems = items.filter((i) => i.currentStatus !== 'SENT')

  function handleTargetChange(newTarget) {
    setTarget(newTarget)
    setStoredWhatsAppTarget(newTarget)
  }

  async function handleSendSingle(item) {
    // 1. Open WhatsApp using selected target ('web', 'desktop', or 'universal')
    openWhatsApp(item.whatsapp_number, item.message, target)

    // 2. Mark locally as SENT
    setSentMap((prev) => ({ ...prev, [item.student_id]: 'SENT' }))

    // 3. Sync to backend if notification_id exists
    if (item.notification_id) {
      try {
        await markNotificationSent(item.notification_id)
      } catch (err) {
        console.warn('Failed to mark notification sent on server:', err)
      }
    }
  }

  // When opened via Save action with autoSendFirst, auto-trigger the first student immediately via desktop
  useEffect(() => {
    if (open && autoSendFirst && !autoSentRef.current && dispatches.length > 0) {
      autoSentRef.current = true
      const first = dispatches[0]
      handleSendSingle(first)

      const remaining = dispatches.slice(1)
      if (remaining.length > 0) {
        setPendingTargetItem(remaining[0])
        setCountdown(10)
        setAutoRunning(true)
      }
    }
    if (!open) {
      autoSentRef.current = false
    }
  }, [open, autoSendFirst, dispatches])


  // Auto-dispatch with 10s delay countdown
  function startAutoDispatch() {
    if (pendingItems.length === 0) return
    setAutoRunning(true)
    // Send first item immediately, then queue the rest with 10s delay
    const first = pendingItems[0]
    handleSendSingle(first)

    const remaining = pendingItems.slice(1)
    if (remaining.length > 0) {
      setPendingTargetItem(remaining[0])
      setCountdown(10)
    } else {
      setAutoRunning(false)
      setPendingTargetItem(null)
    }
  }

  function pauseAutoDispatch() {
    setAutoRunning(false)
    setPendingTargetItem(null)
    setCountdown(10)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  function skipCountdownAndSendNow() {
    if (!pendingTargetItem) return
    if (timerRef.current) clearInterval(timerRef.current)

    const targetToSend = pendingTargetItem
    handleSendSingle(targetToSend)

    const nextRemaining = items.filter(
      (i) => i.currentStatus !== 'SENT' && i.student_id !== targetToSend.student_id
    )

    if (nextRemaining.length > 0) {
      setPendingTargetItem(nextRemaining[0])
      setCountdown(10)
    } else {
      setAutoRunning(false)
      setPendingTargetItem(null)
      setCountdown(10)
    }
  }

  // Timer interval effect: decrements countdown every second
  useEffect(() => {
    if (!autoRunning || !pendingTargetItem) return

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev > 1) {
          return prev - 1
        }
        return 0
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [autoRunning, pendingTargetItem])

  // Timer expiration effect: triggers next dispatch when countdown hits 0
  useEffect(() => {
    if (!autoRunning || countdown !== 0 || !pendingTargetItem) return

    const targetToSend = pendingTargetItem
    handleSendSingle(targetToSend)

    const nextRemaining = items.filter(
      (i) => i.currentStatus !== 'SENT' && i.student_id !== targetToSend.student_id
    )

    if (nextRemaining.length > 0) {
      setPendingTargetItem(nextRemaining[0])
      setCountdown(10)
    } else {
      setAutoRunning(false)
      setPendingTargetItem(null)
      setCountdown(10)
    }
  }, [autoRunning, countdown, pendingTargetItem, items])

  function handleCopyMessage(id, text) {
    navigator.clipboard.writeText(text || '')
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleCopyAll() {
    const text = items
      .map(
        (i, idx) =>
          `${idx + 1}. ${i.student_name} (${i.student_code || 'N/A'})\n` +
          `Score: ${i.obtained_marks}/${i.total_marks} (${i.percentage}% - Grade: ${i.grade || '—'})\n` +
          `Guardian: ${i.guardian_name} (${i.whatsapp_number})\n` +
          `Message:\n${i.message}`
      )
      .join('\n\n' + '='.repeat(40) + '\n\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2500)
  }

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={() => {
        pauseAutoDispatch()
        onClose()
      }}
      title={`WhatsApp Marks Dispatch — ${subject ? `${subject} (${testName})` : testName}`}
      width="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 text-xl shadow-sm">
            <i className="fab fa-whatsapp"></i>
          </div>
          <div className="flex-1 text-sm text-emerald-950">
            <h4 className="font-semibold text-emerald-900 mb-0.5">
              WhatsApp Marks Alert Dispatch
            </h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Clicking <strong>Send via WhatsApp</strong> opens WhatsApp with the student's result <strong>pre-filled in the chat box</strong>. Press <strong>Enter</strong> in WhatsApp to send, then return here to send the next.
            </p>
          </div>
        </div>

        {/* Dispatch Controls & Stats (matching screenshot exactly) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Open In:
            </span>
            <div className="inline-flex rounded-md shadow-xs bg-white border border-gray-300 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleTargetChange('web')}
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
                onClick={() => handleTargetChange('desktop')}
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
                onClick={() => handleTargetChange('universal')}
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

            {/* Quick Send Next */}
            {pendingItems.length > 0 && !autoRunning && (
              <button
                type="button"
                onClick={() => handleSendSingle(pendingItems[0])}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <i className="fas fa-paper-plane text-xs"></i>
                Send Next
              </button>
            )}

            {/* Auto-dispatch trigger */}
            {totalCount > 0 && sentCount < totalCount && !autoRunning && (
              <button
                type="button"
                onClick={startAutoDispatch}
                className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold px-3.5 py-1.5 rounded shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <i className="fas fa-forward-step text-xs"></i>
                Auto-Dispatch (10s Delay)
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

        {/* 10-Second Auto Countdown Pacing Banner */}
        {autoRunning && pendingTargetItem && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col gap-2 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold font-mono">
                  {countdown}s
                </span>
                <span className="text-xs font-medium text-amber-900">
                  Pacing Delay (10s): Next message will open for{' '}
                  <strong className="text-amber-950">{pendingTargetItem.student_name}</strong>{' '}
                  in {countdown} second{countdown !== 1 ? 's' : ''}...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={skipCountdownAndSendNow}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-2.5 py-1 rounded shadow-xs transition-colors"
                >
                  <i className="fas fa-bolt mr-1"></i>Send Now
                </button>
                <button
                  type="button"
                  onClick={pauseAutoDispatch}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium px-2.5 py-1 rounded transition-colors"
                >
                  <i className="fas fa-pause mr-1"></i>Pause
                </button>
              </div>
            </div>
            {/* Countdown progress bar */}
            <div className="w-full bg-amber-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-600 h-1.5 transition-all duration-1000 ease-linear"
                style={{ width: `${((10 - countdown) / 10) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Recipients List */}
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-[380px] overflow-y-auto bg-white">
          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <i className="fas fa-check-circle text-green-500 text-3xl mb-2"></i>
              <p>No student marks to dispatch for this test.</p>
            </div>
          ) : (
            items.map((item, idx) => {
              const isSent = item.currentStatus === 'SENT'
              const cleanPhone = cleanPhoneNumber(item.whatsapp_number)
              const pct = Number(item.percentage) || 0

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
                        {item.student_code && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {item.student_code}
                          </span>
                        )}
                        {/* Score Pill */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                            pct >= 75
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : pct >= 50
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {item.obtained_marks}/{item.total_marks} ({item.percentage}%) · Grade {item.grade || '—'}
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
                      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2 mt-1.5 font-sans leading-relaxed whitespace-pre-line">
                        <span className="text-gray-400 select-none mr-1 font-serif text-sm">“</span>
                        {item.message}
                        <span className="text-gray-400 select-none ml-1 font-serif text-sm">”</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleSendSingle(item)}
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
            {subject && `${subject} · `}
            {testName}
          </span>
          <button
            type="button"
            onClick={() => {
              pauseAutoDispatch()
              onClose()
            }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors"
          >
            {sentCount === totalCount && totalCount > 0 ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
