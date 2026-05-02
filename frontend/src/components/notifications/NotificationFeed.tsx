// frontend/src/components/notifications/NotificationFeed.tsx
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotificationStore } from '@/store/notificationStore'

function safeFormatDistance(raw: string): string {
  if (!raw) return '—'
  try {
    return formatDistanceToNow(new Date(raw), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function NotificationFeed() {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotificationStore()
  const navigate = useNavigate()

  return (
    <div className="w-80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="overflow-y-auto max-h-96">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex border-b last:border-b-0 ${
                n.readAt === null ? 'border-l-2 border-l-primary bg-primary/5' : ''
              }`}
            >
              {n.link ? (
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => navigate(n.link!)}
                >
                  <p title={n.title} className={`text-sm truncate ${n.readAt === null ? 'font-semibold' : 'font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {safeFormatDistance(n.createdAt)}
                  </p>
                </button>
              ) : (
                <div className="flex-1 min-w-0 px-4 py-3">
                  <p title={n.title} className={`text-sm truncate ${n.readAt === null ? 'font-semibold' : 'font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {safeFormatDistance(n.createdAt)}
                  </p>
                </div>
              )}
              <button
                type="button"
                aria-label={`Dismiss: ${n.title}`}
                className="flex-shrink-0 self-stretch flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => dismiss(n.id)}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
