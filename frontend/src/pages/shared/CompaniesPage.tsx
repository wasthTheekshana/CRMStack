import { useState, useEffect } from 'react'
import { Building2, Plus, Search, Trash2, Edit, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '@/services/companyService'
import type { Company } from '@/models'

export function CompaniesPage() {
  const [companies, setCompanies]       = useState<Company[]>([])
  const [search, setSearch]             = useState('')
  const [isLoading, setIsLoading]       = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [editTarget, setEditTarget]     = useState<Company | null>(null)
  const [form, setForm]                 = useState({ name: '', website: '', phone: '', address: '', notes: '' })
  const [saving, setSaving]             = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)

  useEffect(() => {
    void getCompanies()
      .then(setCompanies)
      .catch(() => toast.error('Failed to load companies'))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', website: '', phone: '', address: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (c: Company) => {
    setEditTarget(c)
    setForm({ name: c.name, website: c.website ?? '', phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateCompany(editTarget.id, {
          name: form.name.trim(),
          website: form.website || null,
          phone: form.phone || null,
          address: form.address || null,
          notes: form.notes || null,
        })
        setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c))
        toast.success('Company updated')
      } else {
        const created = await createCompany({
          name: form.name.trim(),
          website: form.website || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        })
        setCompanies(prev => [...prev, created])
        toast.success('Company created')
      }
      setShowForm(false)
    } catch {
      toast.error('Failed to save company')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCompany(deleteTarget.id)
      setCompanies(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('Company deleted')
    } catch {
      toast.error('Failed to delete company')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground text-sm">{companies.length} total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No companies match your search' : 'No companies yet — add one to get started'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(company => (
            <div key={company.id} className="bg-card border rounded-lg p-4 space-y-2 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{company.name}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(company)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(company)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {company.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />
                  {company.website}
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                {company.leadCount ?? 0} deal{(company.leadCount ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Company' : 'New Company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+94 11 234 5678" />
            </div>
            <div>
              <label className="text-sm font-medium">Website</label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="acme.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the company record. Linked deals will keep their company name but lose the company reference.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
