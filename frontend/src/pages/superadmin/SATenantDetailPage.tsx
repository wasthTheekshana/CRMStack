import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Ban, CheckCircle, Download, Trash2, Loader2, AlertCircle, Users, BarChart2, KeyRound, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  saGetTenantDetail, saUpdateTenant, saExportTenantCSV, saDeleteTenant, saSetFreeTrial, SATenant,
} from '@/services/saService'
import { ChangePasswordModal } from '@/components/superadmin/ChangePasswordModal'
import { toast } from 'sonner'

type TenantDetail = Awaited<ReturnType<typeof saGetTenantDetail>>

function StatusBadge({ status }: { status: SATenant['status'] }) {
  const map: Record<SATenant['status'], { label: string; className: string }> = {
    active:    { label: 'Active',    className: 'bg-green-900/40 text-green-400 border-green-800' },
    trial:     { label: 'Trial',     className: 'bg-yellow-900/40 text-yellow-400 border-yellow-800' },
    suspended: { label: 'Suspended', className: 'bg-red-900/40 text-red-400 border-red-800' },
    cancelled: { label: 'Cancelled', className: 'bg-slate-700 text-slate-400 border-slate-600' },
  }
  const { label, className } = map[status] ?? map.cancelled
  return <Badge variant="outline" className={className}>{label}</Badge>
}

export function SATenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail, setDetail]           = useState<TenantDetail | null>(null)
  const [loading, setLoading]         = useState(true)
  const [editPlan, setEditPlan]       = useState('')
  const [editLimit, setEditLimit]     = useState('')
  const [editSaving, setEditSaving]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteOpen, setDeleteOpen]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [pwTarget, setPwTarget] = useState<{ id: string; email: string } | null>(null)
  const [trialDate, setTrialDate] = useState('')
  const [trialSaving, setTrialSaving] = useState(false)

  const load = () => {
    if (!id) return
    setLoading(true)
    saGetTenantDetail(id)
      .then((d) => {
        setDetail(d)
        setEditPlan(d.tenant.plan)
        setEditLimit(String(d.tenant.userLimit))
        setTrialDate(d.tenant.trialEndsAt ? d.tenant.trialEndsAt.slice(0, 10) : '')
      })
      .catch(() => toast.error('Failed to load tenant'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleStatusToggle = async () => {
    if (!detail || !id) return
    const newStatus = detail.tenant.status === 'suspended' ? 'active' : 'suspended'
    try {
      await saUpdateTenant(id, { status: newStatus })
      toast.success(`Tenant ${newStatus === 'suspended' ? 'suspended' : 'activated'}`)
      load()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleSavePlan = async () => {
    if (!id) return
    setEditSaving(true)
    try {
      await saUpdateTenant(id, { plan: editPlan, userLimit: parseInt(editLimit, 10) })
      toast.success('Tenant updated')
      load()
    } catch {
      toast.error('Failed to update tenant')
    } finally {
      setEditSaving(false)
    }
  }

  const handleEnableTrial = async () => {
    if (!id || !trialDate) return
    setTrialSaving(true)
    try {
      await saSetFreeTrial(id, trialDate)
      toast.success('Free trial enabled')
      load()
    } catch {
      toast.error('Failed to enable trial')
    } finally {
      setTrialSaving(false)
    }
  }

  const handleEndTrial = async () => {
    if (!id) return
    setTrialSaving(true)
    try {
      await saSetFreeTrial(id, null)
      toast.success('Free trial ended — account set to active')
      load()
    } catch {
      toast.error('Failed to end trial')
    } finally {
      setTrialSaving(false)
    }
  }

  const handleExport = async () => {
    if (!id || !detail) return
    try {
      const res = await saExportTenantCSV(id)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${detail.tenant.subdomain}-export.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    }
  }

  const handleDelete = async () => {
    if (!id || !detail || deleteConfirm !== detail.tenant.subdomain) return
    setDeleteLoading(true)
    try {
      await saDeleteTenant(id)
      toast.success(`Tenant "${detail.tenant.name}" deleted`)
      navigate('/superadmin/tenants')
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center gap-2 text-red-400 p-4">
        <AlertCircle className="h-5 w-5" />
        <span>Tenant not found</span>
      </div>
    )
  }

  const { tenant, users, stats, config } = detail

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => navigate('/superadmin/tenants')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="text-slate-400 text-sm mt-0.5 font-mono">{tenant.subdomain}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            className={tenant.status === 'suspended'
              ? 'border-green-700 text-green-400 hover:bg-green-900/20'
              : 'border-yellow-700 text-yellow-400 hover:bg-yellow-900/20'}
            onClick={handleStatusToggle}
          >
            {tenant.status === 'suspended'
              ? <><CheckCircle className="h-4 w-4 mr-2" />Activate</>
              : <><Ban className="h-4 w-4 mr-2" />Suspend</>}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Info + Edit row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tenant Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Tenant Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Plan',        tenant.plan],
              ['User Limit',  String(tenant.userLimit)],
              ['Owner Email', tenant.ownerEmail],
              ['Created',     new Date(tenant.createdAt).toLocaleDateString()],
              ['Trial Ends',  tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="text-white capitalize">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Edit Plan */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Edit Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-sm">Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
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
              <Label className="text-slate-400 text-sm">User Limit</Label>
              <Input
                type="number" min="1" value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSavePlan}
              disabled={editSaving}
            >
              {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Free Trial */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-yellow-400" />
            Free Trial
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.status === 'trial' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                <FlaskConical className="h-4 w-4" />
                Trial active
                {tenant.trialEndsAt && (
                  <span className="text-slate-400 font-normal">
                    · expires {new Date(tenant.trialEndsAt).toLocaleDateString()}
                    {' '}({Math.max(0, Math.round((new Date(tenant.trialEndsAt).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86_400_000))} days left)
                  </span>
                )}
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-slate-400 text-sm">Extend expiry date</Label>
                  <input
                    type="date"
                    value={trialDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setTrialDate(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                  onClick={handleEnableTrial}
                  disabled={trialSaving || !trialDate}
                >
                  {trialSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Update Expiry
                </Button>
                <Button
                  variant="outline"
                  className="border-red-700 text-red-400 hover:bg-red-900/20 whitespace-nowrap"
                  onClick={handleEndTrial}
                  disabled={trialSaving}
                >
                  End Trial
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">No active free trial. Set an expiry date to enable one.</p>
              <div className="flex items-end gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-slate-400 text-sm">Trial expiry date</Label>
                  <input
                    type="date"
                    value={trialDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setTrialDate(e.target.value)}
                    className="w-full rounded-md border border-slate-600 bg-slate-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <Button
                  className="bg-yellow-600 hover:bg-yellow-700 whitespace-nowrap"
                  onClick={handleEnableTrial}
                  disabled={trialSaving || !trialDate}
                >
                  {trialSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Enable Trial
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-indigo-400" />
            <div>
              <p className="text-slate-400 text-xs">Total Leads</p>
              <p className="text-white text-xl font-bold">{stats.leadCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-slate-400 text-xs">Total Activities</p>
              <p className="text-white text-xl font-bold">{stats.activityCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Last Login</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-700/30">
                  <td className="px-4 py-2 text-white">{u.displayName}</td>
                  <td className="px-4 py-2 text-slate-400">{u.email}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={u.role === 'admin' ? 'border-indigo-700 text-indigo-400' : 'border-slate-600 text-slate-400'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {u.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-400 hover:text-white h-7 gap-1 text-xs"
                        onClick={() => setPwTarget({ id: u.id, email: u.email })}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Change Password
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No users</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Config snapshot */}
      {config && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Config Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-slate-400 mb-1">Sales Stages</p>
              <div className="flex flex-wrap gap-1">
                {config.stageNames.map((s) => (
                  <Badge key={s} variant="outline" className="border-slate-600 text-slate-300">{s}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-slate-400 mb-1">Solutions</p>
              <div className="flex flex-wrap gap-1">
                {config.solutionNames.map((s) => (
                  <Badge key={s} variant="outline" className="border-slate-600 text-slate-300">{s}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!o) { setDeleteOpen(false); setDeleteConfirm('') } }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Tenant</DialogTitle>
            <DialogDescription className="text-slate-400">
              This action is permanent. All data (leads, users, activities) will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-300">
              Type <span className="font-mono text-white font-semibold">{tenant.subdomain}</span> to confirm.
            </p>
            <div className="space-y-1">
              <Label className="text-slate-400">Subdomain</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder={tenant.subdomain}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="text-slate-400" onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== tenant.subdomain || deleteLoading}
                onClick={handleDelete}
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChangePasswordModal user={pwTarget} onClose={() => setPwTarget(null)} />
    </div>
  )
}
