// frontend/src/components/notifications/NotificationBell.tsx
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useNotificationStore } from '@/store/notificationStore'
import { NotificationFeed } from './NotificationFeed'

export function NotificationBell() {
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount > 99 ? '99+' : unreadCount} unread` : ''}`}
          className="relative h-9 w-9 md:h-10 md:w-10"
        >
          <Bell className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="end">
        <NotificationFeed />
      </PopoverContent>
    </Popover>
  )
}
