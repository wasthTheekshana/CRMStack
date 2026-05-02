import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useSuperAdminStore } from '@/store/superAdminStore'

interface SAAuthGuardProps {
  children: React.ReactNode
}

export function SAAuthGuard({ children }: SAAuthGuardProps) {
  const { isLoggedIn, isInitialized, initialize } = useSuperAdminStore()

  useEffect(() => {
    if (!isInitialized) initialize()
  }, [isInitialized, initialize])

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <Navigate to="/superadmin/login" replace />
  }

  return <>{children}</>
}
