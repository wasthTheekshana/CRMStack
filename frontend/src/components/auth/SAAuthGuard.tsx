import { Navigate } from 'react-router-dom'
import { useSuperAdminStore } from '@/store/superAdminStore'

interface SAAuthGuardProps {
  children: React.ReactNode
}

export function SAAuthGuard({ children }: SAAuthGuardProps) {
  const { isLoggedIn } = useSuperAdminStore()

  if (!isLoggedIn) {
    return <Navigate to="/superadmin/login" replace />
  }

  return <>{children}</>
}
