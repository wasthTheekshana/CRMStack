import { useState } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { saResetUserPassword } from '@/services/saService'
import { toast } from 'sonner'

interface Props {
  user: { id: string; email: string } | null
  onClose: () => void
}

export function ChangePasswordModal({ user, onClose }: Props) {
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [copied, setCopied]                   = useState(false)

  const valid = newPassword.length >= 8 && newPassword === confirmPassword

  const handleClose = () => {
    if (loading) return
    setNewPassword('')
    setConfirmPassword('')
    setCopied(false)
    onClose()
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(newPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = async () => {
    if (!user || !valid) return
    setLoading(true)
    try {
      await saResetUserPassword(user.id, newPassword)
      toast.success(`Password updated for ${user.email}`)
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Change Password</DialogTitle>
          <DialogDescription className="text-slate-400">
            Set a new password for{' '}
            <strong className="text-white">{user?.email}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-slate-400">New Password</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="Min. 8 characters"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white shrink-0"
                onClick={copyPassword}
                disabled={!newPassword}
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400">Confirm Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="Repeat password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="text-slate-400" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!valid || loading}
              onClick={handleSubmit}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Change Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
