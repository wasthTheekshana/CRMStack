import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Building2, Eye, Ban, CheckCircle, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saListTenants, saUpdateTenant, saDeleteTenant, saExportTenantCSV, SATenant } from '@/services/saService'
import { SACreateTenantModal } from './SACreateTenantModal'
import { toast } from 'sonner'

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

export function SATenantsPage() {
  const [tenants, setTenants]             = useState<SATenant[]>([])
  const [loading, setLoading]             = useState(true)
  const [createOpen, setCreateOpen]       = useState(false)
  const [deleteTarget, setDeleteTarget]   = useState<SATenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    saListTenants()
      .then(setTenants)
      .catch(() => toast.error('Failed to load tenants'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleStatus = async (t: SATenant) => {
    const newStatus = t.status === 'suspended' ? 'active' : 'suspended'
    try {
      await saUpdateTenant(t.id, { status: newStatus })
      toast.success(`Tenant ${newStatus === 'suspended' ? 'suspended' : 'activated'}`)
      load()
    } catch {
      toast.error('Failed to update tenant status')
    }
  }

  const handleExportDelete = async (t: SATenant) => {
    try {
      const res = await saExportTenantCSV(t.id)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t.subdomain}-export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed')
    }
    setDeleteTarget(t)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.subdomain) return
    setDeleteLoading(true)
    try {
      await saDeleteTenant(deleteTarget.id)
      toast.success(`Tenant "${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      setDeleteConfirm('')
      load()
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-1">Manage all client tenants</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Tenant
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Subdomain</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Users</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tenants.map((t) => (
                <tr key={t.id} className="bg-slate-900 hover:bg-slate-800/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      <span className="text-white font-medium">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{t.subdomain}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{t.plan}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{t.userCount}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-white"
                        onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className={`h-7 w-7 ${t.status === 'suspended' ? 'text-green-400 hover:text-green-300' : 'text-yellow-400 hover:text-yellow-300'}`}
                        onClick={() => toggleStatus(t)}
                        title={t.status === 'suspended' ? 'Activate' : 'Suspend'}
                      >
                        {t.status === 'suspended'
                          ? <CheckCircle className="h-4 w-4" />
                          : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        onClick={() => handleExportDelete(t)}
                        title="Export & Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No tenants yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <SACreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirm('') } }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Tenant</DialogTitle>
            <DialogDescription className="text-slate-400">
              This action is permanent and cannot be undone. All data will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-300">
              Type{' '}
              <span className="font-mono text-white font-semibold">{deleteTarget?.subdomain}</span>
              {' '}to confirm.
            </p>
            <div className="space-y-1">
              <Label className="text-slate-400">Subdomain</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white"
                placeholder={deleteTarget?.subdomain}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost" className="text-slate-400"
                onClick={() => { setDeleteTarget(null); setDeleteConfirm('') }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirm !== deleteTarget?.subdomain || deleteLoading}
                onClick={handleDelete}
              >
                {deleteLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
