import { create } from 'zustand'
import { API_BASE_URL } from '@/config/api'

interface AdminInfo {
  adminId: string
  email:   string
}

interface SuperAdminState {
  admin:         AdminInfo | null
  isLoggedIn:    boolean
  isInitialized: boolean
  login(admin: AdminInfo): void
  logout(): Promise<void>
  initialize(): Promise<void>
}

export const useSuperAdminStore = create<SuperAdminState>((set) => ({
  admin:         null,
  isLoggedIn:    false,
  isInitialized: false,

  login(admin) {
    // M7: token is stored in httpOnly cookie by the server — nothing to store here
    set({ admin, isLoggedIn: true })
  },

  async logout() {
    try {
      await fetch(`${API_BASE_URL}/api/super-admin/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch { /* Always clear client state */ }
    set({ admin: null, isLoggedIn: false })
  },

  async initialize() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/super-admin/me`, {
        credentials: 'include',
      })
      if (res.ok) {
        const admin: AdminInfo = await res.json()
        set({ admin, isLoggedIn: true, isInitialized: true })
      } else {
        set({ isInitialized: true })
      }
    } catch {
      set({ isInitialized: true })
    }
  },
}))
