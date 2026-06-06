// frontend/src/pages/auth/LoginPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuthStore } from '@/store/authStore'
import { hexToHsl } from '@/utils/color'

interface PublicBranding {
  companyName:  string | null
  logoUrl:      string | null
  primaryColor: string | null
}

export function LoginPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [branding, setBranding] = useState<PublicBranding>({ companyName: null, logoUrl: null, primaryColor: null })

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    void fetch('/api/public/branding')
      .then(r => r.ok ? r.json() : null)
      .then((data: PublicBranding | null) => {
        if (data) {
          setBranding(data)
          if (data.primaryColor) {
            if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(data.primaryColor)) {
              document.documentElement.style.setProperty('--primary', hexToHsl(data.primaryColor))
            }
          }
        }
      })
      .catch(() => {/* silently ignore — fall back to defaults */})
  }, [])

  const companyName = branding.companyName ?? 'CRM STACK'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={companyName}
                className="h-16 w-auto object-contain"
              />
            ) : (
              <img
                src="/crmstack_logo.png"
                alt={companyName}
                className="h-16 w-auto object-contain"
              />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{companyName}</CardTitle>
          <CardDescription>
            Sign in to access your sales dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
