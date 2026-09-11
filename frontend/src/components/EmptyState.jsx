export default function EmptyState({ title = 'No data found', subtitle, icon = 'fa-inbox' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <i className={`fas ${icon} text-4xl mb-3`}></i>
      <p className="text-gray-600 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
