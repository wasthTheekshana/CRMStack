import { API_BASE_URL } from '@/config/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SATenant {
  id: string
  name: string
  subdomain: string
  plan: string
  status: 'active' | 'suspended' | 'trial' | 'cancelled'
  userLimit: number
  ownerEmail: string
  userCount: number
  leadCount: number
  createdAt: string
  trialEndsAt: string | null
}

export interface SAUser {
  id: string
  email: string
  displayName: string
  role: string
  tenantId: string
  tenantName: string
  tenantSubdomain: string
  lastLoginAt: string | null
}

export interface SAStats {
  active: number
  suspended: number
  trial: number
  total: number
  totalUsers: number
  totalLeads: number
  totalActivities: number
  newThisMonth: number
  estimatedMRR: number
  planCounts: Record<string, number>
  monthlyGrowth: Array<{ month: string; count: number }>
  recentTenants: Array<{ id: string; name: string; plan: string; status: string; createdAt: string }>
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

// M7: credentials: 'include' sends the httpOnly cookie automatically — no Authorization header
export async function saFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ─── SA API functions ─────────────────────────────────────────────────────────

export const saLogin = (email: string, password: string) =>
  saFetch<{ admin: { adminId: string; email: string; displayName: string } }>('/api/super-admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const saGetStats = () => saFetch<SAStats>('/api/super-admin/stats')

export const saListTenants = () => saFetch<SATenant[]>('/api/super-admin/tenants')

export const saCreateTenant = (data: {
  name: string; subdomain: string; plan: string; userLimit: number
  trialEndsAt?: string | null; adminName: string; adminEmail: string
}) => saFetch<{ tenant: Omit<SATenant, 'userCount' | 'leadCount' | 'ownerEmail' | 'createdAt' | 'trialEndsAt'>; adminEmail: string; tempPassword: string }>(
  '/api/super-admin/tenants', { method: 'POST', body: JSON.stringify(data) }
)

export const saGetTenantDetail = (id: string) =>
  saFetch<{ tenant: SATenant & { suspendedAt: string | null }; users: Array<{ id: string; email: string; displayName: string; role: string; isActive: boolean; lastLoginAt: string | null }>; stats: { leadCount: number; activityCount: number }; config: { stageNames: string[]; solutionNames: string[] } | null }>(
    `/api/super-admin/tenants/${id}`
  )

export const saUpdateTenant = (id: string, data: { plan?: string; userLimit?: number; status?: string; trialEndsAt?: string | null }) =>
  saFetch<SATenant>(`/api/super-admin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) })

/**
 * Enable free trial (pass ISO date string) or end it (pass null).
 * Enabling sets status='trial' + trial_ends_at.
 * Ending sets status='active' + clears trial_ends_at.
 */
export const saSetFreeTrial = (id: string, trialEndsAt: string | null) =>
  saFetch<SATenant>(`/api/super-admin/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(
      trialEndsAt !== null
        ? { status: 'trial', trialEndsAt }
        : { status: 'active', trialEndsAt: null }
    ),
  })

export const saExportTenantCSV = (id: string) =>
  fetch(`${API_BASE_URL}/api/super-admin/tenants/${id}/export`, {
    credentials: 'include',
  })

export const saDeleteTenant = (id: string) =>
  saFetch<{ deleted: boolean; tenant: { id: string; name: string; subdomain: string } }>(
    `/api/super-admin/tenants/${id}`, { method: 'DELETE' }
  )

export const saSearchUsers = (email: string) =>
  saFetch<SAUser[]>(`/api/super-admin/users/search?email=${encodeURIComponent(email)}`)

export const saResetUserPassword = (id: string, tempPassword: string) =>
  saFetch<{ updated: boolean; userId: string; email: string; displayName: string }>(
    `/api/super-admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ tempPassword }) }
  )
