import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SAAuthGuard } from '@/components/auth/SAAuthGuard'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage }  from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage }   from '@/pages/auth/ResetPasswordPage'
import { TrialExpiredPage }    from '@/pages/auth/TrialExpiredPage'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { SalesDashboard } from '@/pages/sales/SalesDashboard'
import { RepComparison } from '@/pages/admin/RepComparison'
import { TeamManagement } from '@/pages/admin/TeamManagement'
import { QuarterlyTargets } from '@/pages/admin/QuarterlyTargets'
import { WorkspaceSettings } from '@/pages/admin/WorkspaceSettings'
import { PipelinePage } from '@/pages/shared/PipelinePage'
import { AnalyticsPage } from '@/pages/shared/AnalyticsPage'
import { LeadsPage } from '@/pages/shared/LeadsPage'
import { ReportsPage } from '@/pages/shared/ReportsPage'
import { ProfilePage } from '@/pages/shared/ProfilePage'
import { SalesTargetsPage } from '@/pages/shared/SalesTargetsPage'
import { DeletedLeadsPage } from '@/pages/shared/DeletedLeadsPage'
import { CompaniesPage } from '@/pages/shared/CompaniesPage'
import { SALogin } from '@/pages/superadmin/SALogin'
import { SALayout } from '@/pages/superadmin/SALayout'
import { SADashboard } from '@/pages/superadmin/SADashboard'
import { SATenantsPage } from '@/pages/superadmin/SATenantsPage'
import { SATenantDetailPage } from '@/pages/superadmin/SATenantDetailPage'
import { SAUsersPage } from '@/pages/superadmin/SAUsersPage'

function RoleBasedDashboard() {
  const { userProfile } = useAuthStore()

  if (userProfile?.role === 'admin') {
    return <AdminDashboard />
  }
  return <SalesDashboard />
}

function App() {
  const { initialize, trialExpired } = useAuthStore()

  useEffect(() => {
    const unsubscribe = initialize()
    return () => unsubscribe()
  }, [initialize])

  if (trialExpired) {
    return <TrialExpiredPage />
  }

  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4000}
      />
      <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard - role-based */}
        <Route index element={<RoleBasedDashboard />} />

        {/* Shared routes */}
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="targets" element={<SalesTargetsPage />} />
        <Route path="deleted-leads" element={<DeletedLeadsPage />} />
        <Route path="companies" element={<CompaniesPage />} />

        {/* Admin-only routes */}
        <Route
          path="rep-comparison"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <RepComparison />
            </RoleGuard>
          }
        />
        <Route
          path="team-management"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <TeamManagement />
            </RoleGuard>
          }
        />
        <Route
          path="quarterly-targets"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <QuarterlyTargets />
            </RoleGuard>
          }
        />
        <Route
          path="workspace-settings"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <WorkspaceSettings />
            </RoleGuard>
          }
        />
      </Route>

      {/* Super Admin routes — completely isolated from tenant CRM */}
      <Route path="/superadmin/login" element={<SALogin />} />
      <Route
        path="/superadmin"
        element={
          <SAAuthGuard>
            <SALayout />
          </SAAuthGuard>
        }
      >
        <Route index element={<SADashboard />} />
        <Route path="tenants" element={<SATenantsPage />} />
        <Route path="tenants/:id" element={<SATenantDetailPage />} />
        <Route path="users" element={<SAUsersPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default App
