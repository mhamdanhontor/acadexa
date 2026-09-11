export default function ErrorAlert({ message, onRetry }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded bg-red-100 hover:bg-red-200 px-3 py-1 text-red-800 font-medium"
        >
          Retry
        </button>
      )}
    </div>
  )
}
