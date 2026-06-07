import { useState, useEffect } from 'react'
import { Building2, Plus, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { getCompanies, createCompany } from '@/services/companyService'
import type { Company } from '@/models'

interface CompanyPickerProps {
  value:    string   // companyId or ''
  name:     string   // display name (for when no id yet)
  onChange: (companyId: string, companyName: string) => void
}

export function CompanyPicker({ value, name, onChange }: CompanyPickerProps) {
  const [open,      setOpen]      = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [search,    setSearch]    = useState('')
  const [creating,  setCreating]  = useState(false)

  useEffect(() => {
    void getCompanies().then(setCompanies).catch(() => {})
  }, [])

  const selected = companies.find(c => c.id === value)
  const displayName = selected?.name ?? name

  const filtered = search
    ? companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies

  const handleSelect = (company: Company) => {
    onChange(company.id, company.name)
    setOpen(false)
    setSearch('')
  }

  const noMatch = search.trim() !== '' && filtered.length === 0

  const handleCreateNew = async () => {
    const newName = search.trim()
    if (!newName) return
    setCreating(true)
    try {
      const created = await createCompany({ name: newName })
      setCompanies(prev => [...prev, created])
      onChange(created.id, created.name)
      setOpen(false)
      setSearch('')
    } catch {
      toast.error('Failed to create company')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            {displayName || <span className="text-muted-foreground">Select company…</span>}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Search or create…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && noMatch) void handleCreateNew() }}
          className="mb-2 h-8 text-sm"
          autoFocus
        />
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {filtered.map(company => (
            <button
              key={company.id}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
              onClick={() => handleSelect(company)}
            >
              <Check className={cn('h-3.5 w-3.5 shrink-0', company.id === value ? 'opacity-100' : 'opacity-0')} />
              <span className="flex-1 truncate">{company.name}</span>
              <span className="text-xs text-muted-foreground">{company.leadCount ?? 0}</span>
            </button>
          ))}
          {noMatch && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left text-primary"
              onClick={handleCreateNew}
              disabled={creating}
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? 'Creating…' : `Create "${search.trim()}"`}
            </button>
          )}
          {companies.length === 0 && !search && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No companies yet — type to create</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
