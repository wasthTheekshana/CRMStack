import { LogOut, User, Menu, Settings, Key } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/badge'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface HeaderProps {
  title?: string
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export function Header({ title, onMenuClick, showMenuButton }: HeaderProps) {
  const { userProfile, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-lg md:text-xl font-semibold truncate">{title || 'Dashboard'}</h1>
          <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            {getGreeting()}, <span className="font-medium text-foreground">{userProfile?.displayName}</span>!
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <NotificationBell />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 md:h-10 px-2 md:px-3">
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary-foreground" />
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">{userProfile?.displayName}</p>
                <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userProfile?.displayName}</p>
              <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
              <Badge variant="outline" className="mt-2 capitalize">
                {userProfile?.role}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <Settings className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/profile?tab=security')}>
              <Key className="mr-2 h-4 w-4" />
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
