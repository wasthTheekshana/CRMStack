import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiFetch, tokenStorage } from '@/config/api'
import { User } from '@/types'

interface AuthUser {
  id:          string
  email:       string
  username:    string
  displayName: string
  role:        'admin' | 'sales'
  isActive:    boolean
  tenantId:    string
  plan:        string
}

interface AuthState {
  user:            AuthUser | null
  userProfile:     User | null
  isLoading:       boolean
  isAuthenticated: boolean
  error:           string | null
  initialized:     boolean
  login:           (username: string, password: string) => Promise<void>
  logout:          () => Promise<void>
  setUser:         (user: AuthUser | null) => void
  setUserProfile:  (profile: User | null) => void
  setLoading:      (loading: boolean) => void
  setError:        (error: string | null) => void
  clearError:      () => void
  initialize:      () => () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      userProfile:     null,
      isLoading:       true,
      isAuthenticated: false,
      error:           null,
      initialized:     false,

      setUser:        (user)    => set({ user, isAuthenticated: !!user }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      setLoading:     (loading) => set({ isLoading: loading }),
      setError:       (error)   => set({ error }),
      clearError:     ()        => set({ error: null }),

      login: async (username, password) => {
        set({ isLoading: true, error: null })
        try {
          const { token, user } = await apiFetch<{ token: string; user: AuthUser }>(
            '/api/auth/login',
            {
              method: 'POST',
              body: JSON.stringify({ username, password }),
            }
          )

          tokenStorage.set(token)

          const userProfile: User = {
            uid:         user.id,
            id:          user.id,
            email:       user.email,
            username:    user.username,
            displayName: user.displayName,
            role:        user.role,
            isActive:    user.isActive,
          } as unknown as User

          set({
            user,
            userProfile,
            isAuthenticated: true,
            isLoading:       false,
            initialized:     true,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      logout: async () => {
        tokenStorage.clear()
        set({
          user:            null,
          userProfile:     null,
          isAuthenticated: false,
          isLoading:       false,
        })
      },

      initialize: () => {
        const token = tokenStorage.get()
        if (!token) {
          set({ isLoading: false, initialized: true })
          return () => {}
        }

        // Verify token is still valid
        apiFetch<AuthUser>('/api/auth/me')
          .then((user) => {
            const userProfile: User = {
              uid:         user.id,
              id:          user.id,
              email:       user.email,
              username:    user.username,
              displayName: user.displayName,
              role:        user.role,
              isActive:    user.isActive,
            } as unknown as User

            set({
              user,
              userProfile,
              isAuthenticated: true,
              isLoading:       false,
              initialized:     true,
            })
          })
          .catch(() => {
            tokenStorage.clear()
            set({
              user:            null,
              userProfile:     null,
              isAuthenticated: false,
              isLoading:       false,
              initialized:     true,
            })
          })

        return () => {} // no cleanup needed (no listener)
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export const useIsAdmin = () => {
  const userProfile = useAuthStore((state) => state.userProfile)
  return userProfile?.role === 'admin'
}

export const useIsSales = () => {
  const userProfile = useAuthStore((state) => state.userProfile)
  return userProfile?.role === 'sales'
}

export const useTenantId = () => {
  const user = useAuthStore((state) => state.user)
  return user?.tenantId ?? null
}

export const usePlan = () => {
  const user = useAuthStore((state) => state.user)
  return user?.plan ?? null
}
