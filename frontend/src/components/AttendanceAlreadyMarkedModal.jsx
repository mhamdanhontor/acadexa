import Modal from './Modal'

export default function AttendanceAlreadyMarkedModal({
  open,
  onClose,
  sessionDate = '',
  className = '',
  batchName = '',
  counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 },
  totalStudents = 0,
  onOpenWhatsApp,
}) {
  const notifyCount = (counts.ABSENT || 0) + (counts.LATE || 0) + (counts.LEAVE || 0)

  return (
    <Modal open={open} title="Attendance Already Marked" onClose={onClose} width="max-w-lg">
      <div className="space-y-5 py-1">
        {/* Header Icon & Notice */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200/80 rounded-2xl p-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-green-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 text-xl">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
              Attendance Recorded Today
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Completed
              </span>
            </h3>
            <p className="text-xs text-emerald-800/90 mt-0.5 leading-relaxed">
              Attendance has already been recorded for this session today. You may review the entries or make corrections below.
            </p>
          </div>
        </div>

        {/* Context Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-200">
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <i className="far fa-calendar-days text-gray-400"></i>
            Date: <strong className="text-gray-900">{sessionDate}</strong>
          </span>
          {(className || batchName) && (
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <i className="fas fa-layer-group text-gray-400"></i>
              {className} {batchName ? `(${batchName})` : ''}
            </span>
          )}
          <span className="font-semibold text-gray-800">
            {totalStudents} student{totalStudents === 1 ? '' : 's'} total
          </span>
        </div>

        {/* Status Count Pills */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
            <span className="text-[11px] font-semibold uppercase text-emerald-700 tracking-wider block">Present</span>
            <span className="text-xl font-bold text-emerald-900 mt-0.5 block">{counts.PRESENT || 0}</span>
          </div>
          <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-center">
            <span className="text-[11px] font-semibold uppercase text-rose-700 tracking-wider block">Absent</span>
            <span className="text-xl font-bold text-rose-900 mt-0.5 block">{counts.ABSENT || 0}</span>
          </div>
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-center">
            <span className="text-[11px] font-semibold uppercase text-amber-700 tracking-wider block">Late</span>
            <span className="text-xl font-bold text-amber-900 mt-0.5 block">{counts.LATE || 0}</span>
          </div>
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-center">
            <span className="text-[11px] font-semibold uppercase text-blue-700 tracking-wider block">Leave</span>
            <span className="text-xl font-bold text-blue-900 mt-0.5 block">{counts.LEAVE || 0}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
          {notifyCount > 0 && onOpenWhatsApp && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenWhatsApp()
              }}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-[#25D366] hover:bg-[#20ba5a] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <i className="fab fa-whatsapp text-sm"></i>
              Send WhatsApp ({notifyCount})
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <i className="fas fa-pen-to-square text-xs"></i>
            Review / Edit Attendance
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  )
}
