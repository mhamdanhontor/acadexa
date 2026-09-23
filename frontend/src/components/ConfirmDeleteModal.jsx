import Modal from './Modal'

export default function ConfirmDeleteModal({
  open,
  title = 'Delete Item',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName = '',
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} width="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <i className="fas fa-trash-can text-lg"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
            {itemName && (
              <div className="mt-2.5 p-2 bg-gray-50 border border-gray-200 rounded-md">
                <span className="text-xs text-gray-500 font-medium block">Item to delete:</span>
                <span className="text-sm font-semibold text-gray-900 break-words">{itemName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading && <i className="fas fa-spinner fa-spin text-xs"></i>}
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
