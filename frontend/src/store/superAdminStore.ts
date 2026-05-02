import { create } from 'zustand'

interface SuperAdminState {
  token:      string | null
  admin:      { adminId: string; email: string } | null
  isLoggedIn: boolean
  login(token: string, admin: { adminId: string; email: string }): void
  logout(): void
}

export const useSuperAdminStore = create<SuperAdminState>((set) => ({
  token:      localStorage.getItem('sa_token'),
  admin:      null,
  isLoggedIn: !!localStorage.getItem('sa_token'),
  login(token, admin) {
    localStorage.setItem('sa_token', token)
    set({ token, admin, isLoggedIn: true })
  },
  logout() {
    localStorage.removeItem('sa_token')
    set({ token: null, admin: null, isLoggedIn: false })
  },
}))
