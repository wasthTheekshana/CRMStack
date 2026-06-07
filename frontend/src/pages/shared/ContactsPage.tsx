import { useState, useEffect } from 'react'
import { User, Plus, Search, Trash2, Edit, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getCompanies } from '@/services/companyService'
import { getAllContacts, createContact, updateContact, deleteContact } from '@/services/contactService'
import type { Company, ContactRecord } from '@/models'

export function ContactsPage() {
  const [contacts,      setContacts]      = useState<ContactRecord[]>([])
  const [companies,     setCompanies]     = useState<Company[]>([])
  const [search,        setSearch]        = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [isLoading,     setIsLoading]     = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [editTarget,    setEditTarget]    = useState<ContactRecord | null>(null)
  const [form,          setForm]          = useState({ name: '', phone: '', email: '', designation: '', companyId: '' })
  const [saving,        setSaving]        = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState<ContactRecord | null>(null)

  useEffect(() => {
    void Promise.all([getAllContacts(), getCompanies()])
      .then(([c, co]) => { setContacts(c); setCompanies(co) })
      .catch(() => toast.error('Failed to load contacts'))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCompany = companyFilter === 'all' || c.companyId === companyFilter
    return matchesSearch && matchesCompany
  })

  const getCompanyName = (id: string | null) =>
    id ? (companies.find(c => c.id === id)?.name ?? '—') : '—'

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', phone: '', email: '', designation: '', companyId: '' })
    setShowForm(true)
  }

  const openEdit = (c: ContactRecord) => {
    setEditTarget(c)
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', designation: c.designation ?? '', companyId: c.companyId ?? '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Contact name is required'); return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateContact(editTarget.id, {
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          designation: form.designation || null,
        })
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
        toast.success('Contact updated')
      } else {
        const created = await createContact({
          name: form.name.trim(),
          companyId: form.companyId || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          designation: form.designation || undefined,
        })
        setContacts(prev => [...prev, created])
        toast.success('Contact created')
      }
      setShowForm(false)
    } catch {
      toast.error('Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteContact(deleteTarget.id)
      setContacts(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('Contact deleted')
    } catch {
      toast.error('Failed to delete contact')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm">{contacts.length} total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts…" className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search || companyFilter !== 'all' ? 'No contacts match your filters' : 'No contacts yet'}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(contact => (
            <div key={contact.id} className="bg-card border rounded-lg p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{contact.name}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(contact)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(contact)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {contact.designation && <p className="text-xs text-muted-foreground">{contact.designation}</p>}
              {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
              {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
              <p className="text-xs text-primary/70 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {getCompanyName(contact.companyId)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Contact' : 'New Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-sm font-medium">Company</label>
              <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No company —</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Designation</label>
              <Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="Sales Manager" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@acme.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+94 71 234 5678" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This contact will be removed permanently.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
