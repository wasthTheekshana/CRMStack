import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTenantStore } from '@/store/tenantStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, initialized } = useAuthStore()
  const { loadConfig } = useTenantStore()
  const location = useLocation()

  // Load tenant config once the user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConfig()
    }
  }, [isAuthenticated, loadConfig])

  // Show loading state while checking authentication
  if (!initialized || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
