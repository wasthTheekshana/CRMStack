import { useState } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { saCreateTenant } from '@/services/saService'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

interface CreatedInfo {
  subdomain: string
  adminEmail: string
  adminUsername: string
  tempPassword: string
}

export function SACreateTenantModal({ open, onClose, onCreated }: Props) {
  const [step, setStep]       = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<CreatedInfo | null>(null)
  const [copied, setCopied]   = useState(false)

  const [name, setName]               = useState('')
  const [subdomain, setSubdomain]     = useState('')
  const [plan, setPlan]               = useState('starter')
  const [userLimit, setUserLimit]     = useState('3')
  const [trialEndsAt, setTrialEndsAt] = useState('')
  const [adminName, setAdminName]     = useState('')
  const [adminEmail, setAdminEmail]   = useState('')

  const reset = () => {
    setStep(1); setLoading(false); setCreated(null); setCopied(false)
    setName(''); setSubdomain(''); setPlan('starter'); setUserLimit('3')
    setTrialEndsAt(''); setAdminName(''); setAdminEmail('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await saCreateTenant({
        name,
        subdomain: subdomain.toLowerCase().trim(),
        plan,
        userLimit: parseInt(userLimit, 10),
        trialEndsAt: trialEndsAt || null,
        adminName,
        adminEmail,
      })
      setCreated({
        subdomain: result.tenant.subdomain,
        adminEmail: result.adminEmail,
        adminUsername: result.adminEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
        tempPassword: result.tempPassword,
      })
      setStep(2)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setLoading(false)
    }
  }

  const copyPassword = () => {
    if (created) {
      navigator.clipboard.writeText(created.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-white">Create New Tenant</DialogTitle>
              <DialogDescription className="text-slate-400">
                Creates the tenant and first admin account in one step.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400">Company Name</Label>
                  <Input
                    value={name} onChange={(e) => setName(e.target.value)} required
                    className="bg-slate-700 border-slate-600 text-white" placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400">Subdomain</Label>
                  <Input
                    value={subdomain} onChange={(e) => setSubdomain(e.target.value)} required
                    className="bg-slate-700 border-slate-600 text-white font-mono" placeholder="acme"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400">Plan</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400">User Limit</Label>
                  <Input
                    type="number" min="1" value={userLimit}
                    onChange={(e) => setUserLimit(e.target.value)} required
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400">Trial End Date (optional)</Label>
                <Input
                  type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="border-t border-slate-700 pt-3 space-y-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide">First Admin Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-slate-400">Admin Name</Label>
                    <Input
                      value={adminName} onChange={(e) => setAdminName(e.target.value)} required
                      className="bg-slate-700 border-slate-600 text-white" placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400">Admin Email</Label>
                    <Input
                      type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
                      className="bg-slate-700 border-slate-600 text-white" placeholder="john@acme.com"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" className="text-slate-400" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Tenant
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-green-400">Tenant Created!</DialogTitle>
              <DialogDescription className="text-slate-400">
                Share these credentials with your client. The password will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-slate-900 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Login URL</span>
                  <span className="text-white font-mono text-xs">/?tenant={created?.subdomain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email</span>
                  <span className="text-white">{created?.adminEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Username</span>
                  <span className="text-white font-mono">{created?.adminUsername}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Temp Password</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono">{created?.tempPassword}</span>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-slate-400 hover:text-white"
                      onClick={copyPassword}
                    >
                      {copied
                        ? <Check className="h-3.5 w-3.5 text-green-400" />
                        : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleClose}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
