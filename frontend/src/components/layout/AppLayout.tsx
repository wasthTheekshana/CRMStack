import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/utils/cn'
import { useNotificationStore } from '@/store/notificationStore'
import { useBranding } from '@/store/tenantStore'
import { hexToHsl } from '@/utils/color'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const branding = useBranding()

  // Apply tenant primary color to the CSS variable used by shadcn/ui
  useEffect(() => {
    if (branding.primaryColor) {
      document.documentElement.style.setProperty('--primary', hexToHsl(branding.primaryColor))
    }
  }, [branding.primaryColor])

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  const { startPolling, stopPolling } = useNotificationStore()

  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [startPolling, stopPolling])

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless menu is open */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed && !isMobile}
          onToggle={() => {
            if (isMobile) {
              setMobileMenuOpen(false)
            } else {
              setSidebarCollapsed(!sidebarCollapsed)
            }
          }}
          isMobile={isMobile}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-300',
          // On mobile, no margin. On desktop, margin based on sidebar state
          'md:ml-16',
          !isMobile && !sidebarCollapsed && 'md:ml-64'
        )}
      >
        <Header
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={isMobile}
        />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
