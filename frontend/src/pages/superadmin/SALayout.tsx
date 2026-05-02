import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, Users, LogOut, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSuperAdminStore } from '@/store/superAdminStore'
import { cn } from '@/lib/utils/cn'

const navItems = [
  { to: '/superadmin/',        label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/tenants', label: 'Tenants',   icon: Building2 },
  { to: '/superadmin/users',   label: 'Users',     icon: Users },
]

export function SALayout() {
  const { logout } = useSuperAdminStore()
  const navigate   = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/superadmin/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col border-r border-slate-800">
        {/* Logo area */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-800">
          <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">CRM STACK Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 py-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6">
          <span className="text-slate-400 text-sm font-medium">CRM STACK Admin Panel</span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
