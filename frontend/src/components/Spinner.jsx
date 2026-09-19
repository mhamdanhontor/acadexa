export default function Spinner({ size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
  return (
    <div
      className={`${sizeClass} border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  )
}
