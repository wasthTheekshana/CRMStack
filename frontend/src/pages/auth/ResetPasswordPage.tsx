import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyResetToken, resetPassword } from '@/lib/api/authApi'

export function ResetPasswordPage() {
  const [searchParams]    = useSearchParams()
  const navigate          = useNavigate()
  const token             = searchParams.get('token') ?? ''

  const [tokenValid, setTokenValid]           = useState<boolean | null>(null)
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [isSubmitting, setIsSubmitting]       = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    verifyResetToken(token)
      .then((res) => setTokenValid(res.valid))
      .catch(() => setTokenValid(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await resetPassword(token, newPassword)
      toast.success('Password updated. Please log in.')
      navigate('/login', { replace: true })
    } catch {
      setError('This reset link is invalid or has expired.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-white">D</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Enter your new password below</CardDescription>
        </CardHeader>
        <CardContent>
          {tokenValid === null && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {tokenValid === false && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-600">
                This reset link is invalid or has expired.
              </p>
              <Link to="/forgot-password">
                <Button className="w-full">Request a new link</Button>
              </Link>
            </div>
          )}

          {tokenValid === true && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye    className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !newPassword || !confirmPassword}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set New Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
