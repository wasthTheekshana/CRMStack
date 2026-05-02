import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Kanban,
  BarChart3,
  Users,
  FileText,
  GitCompare,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Target,
  CalendarRange,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useAuthStore, useIsAdmin } from '@/store/authStore'
import { useDashboardStore } from '@/store/dashboardStore'
import { useBranding } from '@/store/tenantStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  onCloseMobile?: () => void
}

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  collapsed: boolean
  onClick?: () => void
}

function NavItem({ to, icon, label, collapsed, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'active:scale-[0.98]',
          isActive
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
            : 'text-muted-foreground'
        )
      }
    >
      {icon}
      {!collapsed && <span className="font-medium">{label}</span>}
    </NavLink>
  )
}

export function Sidebar({ collapsed, onToggle, isMobile, onCloseMobile }: SidebarProps) {
  const isAdmin = useIsAdmin()
  const { userProfile } = useAuthStore()
  const { settings } = useDashboardStore()
  const branding = useBranding()
  const companyName = branding.companyName || 'CRM STACK'
  const companyLetter = companyName.charAt(0).toUpperCase()
  const logoUrl = branding.logoUrl || '/crmstack_logo.png'

  // Check navigation visibility from settings
  const showSalesTargets = settings.navigation?.salesTargets !== false
  const showQuarterlyTargets = settings.navigation?.quarterlyTargets !== false

  const mainNavItems = [
    {
      to: '/',
      icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0" />,
      label: 'Dashboard',
    },
    {
      to: '/pipeline',
      icon: <Kanban className="h-5 w-5 flex-shrink-0" />,
      label: 'Sales Pipeline',
    },
    {
      to: '/analytics',
      icon: <BarChart3 className="h-5 w-5 flex-shrink-0" />,
      label: 'Analytics',
    },
    {
      to: '/leads',
      icon: <Users className="h-5 w-5 flex-shrink-0" />,
      label: 'Leads',
    },
    {
      to: '/reports',
      icon: <FileText className="h-5 w-5 flex-shrink-0" />,
      label: 'Reports',
    },
    // Conditionally show Sales Targets
    ...(showSalesTargets ? [{
      to: '/targets',
      icon: <Target className="h-5 w-5 flex-shrink-0" />,
      label: 'Sales Targets',
    }] : []),
    {
      to: '/deleted-leads',
      icon: <Trash2 className="h-5 w-5 flex-shrink-0" />,
      label: 'Deleted Leads',
    },
  ]

  const adminNavItems = [
    {
      to: '/rep-comparison',
      icon: <GitCompare className="h-5 w-5 flex-shrink-0" />,
      label: 'Rep Comparison',
    },
    // Conditionally show Quarterly Targets
    ...(showQuarterlyTargets ? [{
      to: '/quarterly-targets',
      icon: <CalendarRange className="h-5 w-5 flex-shrink-0" />,
      label: 'Quarterly Targets',
    }] : []),
    {
      to: '/team-management',
      icon: <UserCog className="h-5 w-5 flex-shrink-0" />,
      label: 'Team Management',
    },
    {
      to: '/workspace-settings',
      icon: <Settings className="h-5 w-5 flex-shrink-0" />,
      label: 'Workspace Settings',
    },
  ]

  // On mobile, always show full sidebar (not collapsed)
  const showLabels = isMobile || !collapsed

  return (
    <aside
      className={cn(
        'h-screen bg-card border-r flex flex-col',
        isMobile ? 'w-72' : collapsed ? 'w-16' : 'w-64',
        'transition-all duration-300'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex-shrink-0 bg-primary flex items-center justify-center">
            <img
              src={logoUrl}
              alt={companyName}
              className="h-full w-full object-contain"
              onError={(e) => {
                const target = e.currentTarget
                target.style.display = 'none'
                target.parentElement!.innerHTML = `<span class="text-lg font-bold text-white">${companyLetter}</span>`
              }}
            />
          </div>
          {showLabels && (
            <span className="text-xl font-bold text-foreground">{companyName}</span>
          )}
        </div>
        {/* Mobile close button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCloseMobile}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavItem
            key={item.to}
            collapsed={!showLabels}
            onClick={isMobile ? onCloseMobile : undefined}
            {...item}
          />
        ))}

        {isAdmin && (
          <>
            <Separator className="my-4" />
            <div className={cn('px-3 py-1', !showLabels && 'sr-only')}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Admin
              </span>
            </div>
            {adminNavItems.map((item) => (
              <NavItem
                key={item.to}
                collapsed={!showLabels}
                onClick={isMobile ? onCloseMobile : undefined}
                {...item}
              />
            ))}
          </>
        )}
      </nav>

      {/* User info */}
      <div className="p-4 border-t">
        {showLabels && userProfile && (
          <div className="mb-4">
            <p className="text-sm font-medium truncate">{userProfile.displayName}</p>
            <p className="text-xs text-muted-foreground capitalize">{userProfile.role}</p>
          </div>
        )}
        {/* Only show collapse toggle on desktop */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="w-full flex items-center justify-center"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </aside>
  )
}
