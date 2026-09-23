import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
  { to: '/students', label: 'Students', icon: 'fa-user-graduate' },
  { to: '/classes', label: 'Classes', icon: 'fa-school' },
  { to: '/batches', label: 'Batches', icon: 'fa-layer-group' },
  { to: '/subjects', label: 'Subjects', icon: 'fa-book' },
  { to: '/attendance', label: 'Attendance', icon: 'fa-calendar-check' },
  { to: '/attendance/quick', label: 'Quick Attendance', icon: 'fa-users-viewfinder' },
  { to: '/marks/quick', label: 'Quick Test', icon: 'fa-bolt' },
  { to: '/tests', label: 'Tests', icon: 'fa-file-pen' },
  { to: '/marks', label: 'Marks', icon: 'fa-list-ol' },
  { to: '/reports', label: 'Reports', icon: 'fa-chart-column' },
  { to: '/notifications', label: 'Notifications', icon: 'fa-comment-dots' },
  { to: '/users', label: 'Users & Roles', icon: 'fa-users-gear', roles: ['SUPER_ADMIN'] },
  { to: '/backups', label: 'Backups', icon: 'fa-database', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: 'fa-clipboard-list', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/settings', label: 'Settings', icon: 'fa-gear', roles: ['SUPER_ADMIN', 'ADMIN'] },
]

export default function MainLayout() {
  const { user, logout, hasRole } = useAuth()
  const isOnline = useOnlineStatus()

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles))

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside id="main-sidebar" className="w-64 bg-gray-900 text-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
            <i className="fas fa-graduation-cap text-indigo-400 shrink-0"></i>
            <span>Honor Knowledge Academy</span>
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4" aria-label="Main navigation">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              <i className={`fas ${item.icon} w-4`}></i>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-800 px-5 py-4">
          <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
          <p className="text-xs text-gray-400 truncate">{user?.role_name}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 font-mono">
            <span>Version</span>
            <span className="bg-gray-800 text-indigo-400 px-2 py-0.5 rounded border border-gray-700 font-semibold">v1.0.1</span>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded px-3 py-2 flex items-center gap-2 justify-center"
          >
            <i className="fas fa-arrow-right-from-bracket"></i>
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header id="top-bar" className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Acadexa</span>
            <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
              v1.0.1
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
