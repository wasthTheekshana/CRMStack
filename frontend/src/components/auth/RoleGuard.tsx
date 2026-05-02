import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: ('admin' | 'sales')[]
  fallback?: React.ReactNode
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { userProfile } = useAuthStore()

  if (!userProfile) {
    return <Navigate to="/login" replace />
  }

  const hasAccess = allowedRoles.includes(userProfile.role)

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
