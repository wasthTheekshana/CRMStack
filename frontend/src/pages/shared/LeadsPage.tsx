import { useState, useMemo, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Search, Loader2, Building2, Phone, Filter, X, Upload, Clock, Trash2, Tags, Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { LeadForm } from '@/components/leads/LeadForm'
import { ImportLeadsModal } from '@/components/leads/ImportLeadsModal'
import { ReassignOwnerSelect } from '@/components/leads/ReassignOwnerSelect'
import { DealModal } from '@/components/kanban/DealModal'
import { useLeads } from '@/hooks/useLeads'
import { useLeadExpiry } from '@/hooks/useLeadExpiry'
import { useIsAdmin } from '@/store/authStore'
import { Lead } from '@/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { getRiskLevel } from '@/config/constants'
import { useSalesStages, useStageColor, useCustomFields } from '@/store/tenantStore'
import { ExpiryBadge } from '@/components/leads/ExpiryBadge'
import { LeadAgeBadge } from '@/components/leads/LeadAgeBadge'
import { getLeadAgeDays, getLeadCreatedAt } from '@/lib/utils/leadAge'
import { getSavedViews, createSavedView, deleteSavedView, type SavedView } from '@/services/savedViewService'
import { getSalesUsers } from '@/lib/api/collections'
import type { User } from '@/types'
import { periodStartDate, isOnOrAfter, type RelativePeriod } from '@/lib/utils/dateRange'

type TimelineFilter = 'all' | RelativePeriod

export function LeadsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [stageFilters, setStageFilters] = useState<string[]>([]) // empty = all stages
  const [solutionFilter, setSolutionFilter] = useState<string>('all')
  const [showNewLeadForm, setShowNewLeadForm] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [ageFilter, setAgeFilter] = useState<string>('all')      // admin only
  const [expiryFilter, setExpiryFilter] = useState<string>('all') // admin only
  const [ownerFilter, setOwnerFilter] = useState<string>('all')       // admin only
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all') // admin only
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkActionKey, setBulkActionKey] = useState(0)
  const [savedViews,        setSavedViews]        = useState<SavedView[]>([])
  const [activeViewId,      setActiveViewId]       = useState<string | null>(null)
  const [savingView,        setSavingView]         = useState(false)
  const [saveViewName,      setSaveViewName]       = useState('')
  const [showSaveViewInput, setShowSaveViewInput]  = useState(false)

  const { leads, isLoading, createLead, updateLead, deleteLead, reassignLead, bulkUpdate, bulkDelete, refetch } = useLeads()
  const isAdmin = useIsAdmin()
  const salesStages = useSalesStages()
  const getStageColor = useStageColor()
  const cfConfigs = useCustomFields()
  const { expiryMap, refetch: refetchExpiry } = useLeadExpiry()

  // Load saved views on mount
  useEffect(() => {
    void getSavedViews()
      .then(setSavedViews)
      .catch(() => {/* silently ignore */})
  }, [])

  // Fetch sales users on mount (admin only, for the owner filter)
  useEffect(() => {
    if (!isAdmin) return
    getSalesUsers()
      .then(setSalesUsers)
      .catch(() => {/* silently ignore */})
  }, [isAdmin])

  // Current filter snapshot for saving views
  const currentFilters = useMemo(() => ({
    searchTerm,
    stageFilters,
    solutionFilter,
    ageFilter,
    expiryFilter,
    ownerFilter,
    timelineFilter,
  }), [searchTerm, stageFilters, solutionFilter, ageFilter, expiryFilter, ownerFilter, timelineFilter])

  // Get unique solutions from actual leads data
  const uniqueSolutions = useMemo(() => {
    const solutions = new Set<string>()
    leads.forEach(lead => {
      if (lead.solution) {
        solutions.add(lead.solution)
      }
    })
    return Array.from(solutions).sort()
  }, [leads])

  // Filter leads
  const filteredLeads = useMemo(() => {
    const timelineStart = timelineFilter === 'all' ? null : periodStartDate(timelineFilter)

    return leads.filter((lead) => {
      const primaryContact = lead.contacts?.find(c => c.isPrimary) || lead.contacts?.[0]
      const contactName = primaryContact?.name || lead.contactName || ''

      const matchesSearch =
        lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.solution.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStages = stageFilters.length === 0 || stageFilters.includes(lead.salesStage)
      const matchesSolution = solutionFilter === 'all' || lead.solution === solutionFilter

      // Computed once and reused below — getLeadCreatedAt scans cfConfigs for a
      // matching date field, no need to pay that scan twice per lead.
      const leadCreatedAt = getLeadCreatedAt(lead, cfConfigs)

      const matchesAge = ageFilter === 'all' || getLeadAgeDays(leadCreatedAt) >= parseInt(ageFilter)

      const expiryData = expiryMap[lead.id]
      const matchesExpiry =
        expiryFilter === 'all' ||
        (expiryFilter === 'expired' && expiryData !== undefined && expiryData.daysUntil < 0) ||
        (expiryFilter === 'expiring7' && expiryData !== undefined && expiryData.daysUntil >= 0 && expiryData.daysUntil <= 7) ||
        (expiryFilter === 'none' && expiryData === undefined)

      const matchesOwner = ownerFilter === 'all' || lead.ownerId === ownerFilter

      // Same tenant-aware creation date as the Lead Age filter above, not the raw DB
      // createdAt — otherwise the two filters disagree for tenants that override
      // creation date via a custom field.
      const matchesTimeline = !timelineStart || isOnOrAfter(leadCreatedAt, timelineStart)

      return matchesSearch && matchesStages && matchesSolution && matchesAge && matchesExpiry &&
        matchesOwner && matchesTimeline
    })
  }, [leads, searchTerm, stageFilters, solutionFilter, ageFilter, expiryFilter, expiryMap, cfConfigs, ownerFilter, timelineFilter])

  // Totals for the currently filtered leads (admin-only summary, most useful when an owner is selected)
  const filteredTotals = useMemo(() => {
    const totalValue = filteredLeads.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)
    const weightedRevenue = filteredLeads.reduce(
      (sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100,
      0
    )
    return { totalLeads: filteredLeads.length, totalValue, weightedRevenue }
  }, [filteredLeads])

  const ownerFilterName = useMemo(() => {
    if (ownerFilter === 'all') return null
    return salesUsers.find(u => u.uid === ownerFilter)?.displayName || 'Unknown'
  }, [ownerFilter, salesUsers])

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead)
    setModalOpen(true)
  }

  const clearFilters = () => {
    setStageFilters([])
    setSolutionFilter('all')
    setSearchTerm('')
    setAgeFilter('all')
    setExpiryFilter('all')
    setOwnerFilter('all')
    setTimelineFilter('all')
    setSelectedIds(new Set())
  }

  const hasActiveFilters =
    stageFilters.length > 0 || solutionFilter !== 'all' || searchTerm !== '' ||
    ageFilter !== 'all' || expiryFilter !== 'all' || ownerFilter !== 'all' || timelineFilter !== 'all'

  const handleSaveView = async () => {
    if (!saveViewName.trim()) return
    setSavingView(true)
    try {
      const view = await createSavedView(saveViewName.trim(), currentFilters)
      setSavedViews(prev => [...prev, view])
      setActiveViewId(view.id)
      setSaveViewName('')
      setShowSaveViewInput(false)
      toast.success(`View "${view.name}" saved`)
    } catch {
      toast.error('Failed to save view')
    } finally {
      setSavingView(false)
    }
  }

  const handleLoadView = (view: SavedView) => {
    const f = view.filters
    setSearchTerm(typeof f.searchTerm === 'string' ? f.searchTerm : '')
    setStageFilters(
      Array.isArray(f.stageFilters)
        ? f.stageFilters.filter((s): s is string => typeof s === 'string')
        : typeof f.stageFilter === 'string' && f.stageFilter !== 'all'
          ? [f.stageFilter] // back-compat with views saved before multi-select
          : []
    )
    setSolutionFilter(typeof f.solutionFilter === 'string' ? f.solutionFilter : 'all')
    setAgeFilter(typeof f.ageFilter === 'string' ? f.ageFilter : 'all')
    setExpiryFilter(typeof f.expiryFilter === 'string' ? f.expiryFilter : 'all')
    setOwnerFilter(typeof f.ownerFilter === 'string' ? f.ownerFilter : 'all')
    setTimelineFilter(
      typeof f.timelineFilter === 'string' ? (f.timelineFilter as TimelineFilter) : 'all'
    )
    setActiveViewId(view.id)
  }

  const handleDeleteView = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteSavedView(id)
      setSavedViews(prev => prev.filter(v => v.id !== id))
      if (activeViewId === id) setActiveViewId(null)
      toast.success('View deleted')
    } catch {
      toast.error('Failed to delete view')
    }
  }

  const toggleStageFilter = (stageName: string) => {
    setStageFilters(prev =>
      prev.includes(stageName) ? prev.filter(s => s !== stageName) : [...prev, stageName]
    )
    setSelectedIds(new Set())
  }

  const stageFilterLabel =
    stageFilters.length === 0
      ? 'All Stages'
      : stageFilters.length === 1
        ? stageFilters[0]
        : `${stageFilters.length} stages`

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleSelectAll = () =>
    setSelectedIds(prev =>
      prev.size === filteredLeads.length
        ? new Set()
        : new Set(filteredLeads.map(l => l.id))
    )

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkStageChange = async (newStage: string) => {
    try {
      await bulkUpdate(Array.from(selectedIds), { salesStage: newStage })
      toast.success(`${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} moved to ${newStage}`)
      clearSelection()
      setBulkActionKey(k => k + 1)
    } catch {
      toast.error('Bulk stage update failed')
    }
  }

  const handleBulkDelete = () => setShowDeleteConfirm(true)

  const confirmBulkDelete = async () => {
    setShowDeleteConfirm(false)
    try {
      await bulkDelete(Array.from(selectedIds))
      toast.success(`${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} deleted`)
      clearSelection()
    } catch {
      toast.error('Bulk delete failed')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Manage your leads and opportunities
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        )}
        <Button onClick={() => setShowNewLeadForm(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search bar with filter button on mobile */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSelectedIds(new Set()) }}
              className="pl-10"
            />
          </div>

          {/* Mobile filter button */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sales Stage</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        {stageFilterLabel}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[240px]">
                      {salesStages.map((stage) => (
                        <DropdownMenuCheckboxItem
                          key={stage.id}
                          checked={stageFilters.includes(stage.name)}
                          onCheckedChange={() => toggleStageFilter(stage.name)}
                          onSelect={e => e.preventDefault()}
                        >
                          {stage.name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Solution</label>
                  <Select value={solutionFilter} onValueChange={v => { setSolutionFilter(v); setSelectedIds(new Set()) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Solutions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Solutions</SelectItem>
                      {uniqueSolutions.map((solution) => (
                        <SelectItem key={solution} value={solution}>
                          {solution}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Team Member</label>
                      <Select value={ownerFilter} onValueChange={v => { setOwnerFilter(v); setSelectedIds(new Set()) }}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Team Members" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Team Members</SelectItem>
                          {salesUsers.map((user) => (
                            <SelectItem key={user.uid} value={user.uid}>
                              {user.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Timeline</label>
                      <Select
                        value={timelineFilter}
                        onValueChange={v => { setTimelineFilter(v as TimelineFilter); setSelectedIds(new Set()) }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="last_week">Last Week</SelectItem>
                          <SelectItem value="last_month">Last Month</SelectItem>
                          <SelectItem value="last_two_months">Last 2 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Lead Age
                      </label>
                      <Select value={ageFilter} onValueChange={v => { setAgeFilter(v); setSelectedIds(new Set()) }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any age" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any age</SelectItem>
                          <SelectItem value="30">1+ month old</SelectItem>
                          <SelectItem value="60">2+ months old</SelectItem>
                          <SelectItem value="90">3+ months old</SelectItem>
                          <SelectItem value="180">6+ months old</SelectItem>
                          <SelectItem value="365">1+ year old</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Expiry Status</label>
                      <Select value={expiryFilter} onValueChange={v => { setExpiryFilter(v); setSelectedIds(new Set()) }}>
                        <SelectTrigger>
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                          <SelectItem value="expiring7">Expiring in 7 days</SelectItem>
                          <SelectItem value="none">No expiry set</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="w-full">
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop filters */}
        <div className="hidden md:flex gap-3 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start font-normal">
                <Tags className="h-3.5 w-3.5 mr-1.5" />
                {stageFilterLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[220px]">
              {salesStages.map((stage) => (
                <DropdownMenuCheckboxItem
                  key={stage.id}
                  checked={stageFilters.includes(stage.name)}
                  onCheckedChange={() => toggleStageFilter(stage.name)}
                  onSelect={e => e.preventDefault()}
                >
                  {stage.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={solutionFilter} onValueChange={v => { setSolutionFilter(v); setSelectedIds(new Set()) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by solution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Solutions</SelectItem>
              {uniqueSolutions.map((solution) => (
                <SelectItem key={solution} value={solution}>
                  {solution}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <>
              <Select value={ownerFilter} onValueChange={v => { setOwnerFilter(v); setSelectedIds(new Set()) }}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Filter by team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {salesUsers.map((user) => (
                    <SelectItem key={user.uid} value={user.uid}>
                      {user.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={timelineFilter}
                onValueChange={v => { setTimelineFilter(v as TimelineFilter); setSelectedIds(new Set()) }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="last_two_months">Last 2 Months</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageFilter} onValueChange={v => { setAgeFilter(v); setSelectedIds(new Set()) }}>
                <SelectTrigger className="w-[160px]">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Any age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any age</SelectItem>
                  <SelectItem value="30">1+ month old</SelectItem>
                  <SelectItem value="60">2+ months old</SelectItem>
                  <SelectItem value="90">3+ months old</SelectItem>
                  <SelectItem value="180">6+ months old</SelectItem>
                  <SelectItem value="365">1+ year old</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expiryFilter} onValueChange={v => { setExpiryFilter(v); setSelectedIds(new Set()) }}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Expiry status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All expiry</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="expiring7">Expiring in 7 days</SelectItem>
                  <SelectItem value="none">No expiry set</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Team member totals - admin only, shown once a team member is selected */}
      {isAdmin && ownerFilter !== 'all' && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-lg border bg-card px-4 py-3">
          <Badge variant="secondary" className="gap-1 w-fit">
            <Filter className="h-3 w-3" />
            {ownerFilterName}
          </Badge>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Leads:</span>
              <span className="font-semibold">{filteredTotals.totalLeads}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Total Value:</span>
              <span className="font-semibold text-blue-600">{formatCurrency(filteredTotals.totalValue)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Weighted Revenue:</span>
              <span className="font-semibold text-green-600">{formatCurrency(filteredTotals.weightedRevenue)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results count + select-all */}
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {filteredLeads.length} of {leads.length} leads
        </p>
        {filteredLeads.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox
              checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            {selectedIds.size > 0
              ? `${selectedIds.size} of ${filteredLeads.length} selected`
              : `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}`}
          </label>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-16 z-30 flex items-center gap-3 bg-background border rounded-lg px-4 py-2.5 shadow-md mb-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />

          <Select key={bulkActionKey} onValueChange={handleBulkStageChange}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <Tags className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Change stage…" />
            </SelectTrigger>
            <SelectContent>
              {salesStages.map(s => (
                <SelectItem key={s.id} value={s.name} className="text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-8 text-xs">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          )}

          <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 text-xs">
            Clear
          </Button>
        </div>
      )}

      {/* Saved views row */}
      {(savedViews.length > 0 || hasActiveFilters) && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {savedViews.map(view => (
            <div
              key={view.id}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors
                ${activeViewId === view.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted hover:bg-muted/80 border-border'}`}
              onClick={() => handleLoadView(view)}
            >
              <BookmarkCheck className="h-3 w-3" />
              {view.name}
              <button
                className="ml-1 opacity-60 hover:opacity-100"
                onClick={e => handleDeleteView(view.id, e)}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Save current filters button */}
          {hasActiveFilters && !showSaveViewInput && (
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              onClick={() => setShowSaveViewInput(true)}
            >
              <Bookmark className="h-3 w-3" />
              Save view
            </button>
          )}

          {showSaveViewInput && (
            <div className="flex items-center gap-1.5">
              <input
                className="h-7 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="View name…"
                value={saveViewName}
                onChange={e => setSaveViewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleSaveView()
                  if (e.key === 'Escape') { setShowSaveViewInput(false); setSaveViewName('') }
                }}
                autoFocus
              />
              <Button size="sm" className="h-7 text-xs" onClick={handleSaveView} disabled={savingView || !saveViewName.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowSaveViewInput(false); setSaveViewName('') }}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Leads Grid - responsive columns */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLeads.map((lead) => {
          const risk = getRiskLevel(lead.probability)
          const expiryData = expiryMap[lead.id]
          return (
            <div key={lead.id} className="relative">
              <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={() => toggleSelect(lead.id)}
                />
              </div>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
              onClick={() => handleLeadClick(lead)}
            >
              <CardContent className="p-3 md:p-4 pl-8 md:pl-9">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold truncate text-sm md:text-base">{lead.companyName}</h3>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{lead.solution}</p>
                  </div>
                  <Badge
                    className="text-xs flex-shrink-0"
                    style={{
                      backgroundColor: `${getStageColor(lead.salesStage)}20`,
                      borderColor: getStageColor(lead.salesStage),
                      color: getStageColor(lead.salesStage),
                    }}
                    variant="outline"
                  >
                    {lead.salesStage}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="truncate">{lead.contactName}</span>
                  </div>
                  {lead.contactNumber && (
                    <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{lead.contactNumber}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2" onClick={e => e.stopPropagation()}>
                  {isAdmin ? (
                    <ReassignOwnerSelect
                      leadId={lead.id}
                      currentOwnerId={lead.ownerId}
                      onReassigned={(updated) => {
                        reassignLead(updated.id, updated.ownerId).catch(() => {})
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <span className="text-muted-foreground">Owner:</span>
                      <span className="truncate">{lead.ownerEmail}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <LeadAgeBadge createdAt={getLeadCreatedAt(lead, cfConfigs)} />
                  <ExpiryBadge daysUntil={expiryData?.daysUntil ?? null} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="font-semibold text-base md:text-lg">
                    {formatCurrency(lead.estimatedRevenue)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-12 md:w-16 bg-muted rounded-full overflow-hidden"
                      title={`${lead.probability}% probability`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${lead.probability}%`,
                          backgroundColor: risk.color,
                        }}
                      />
                    </div>
                    <span className="text-xs md:text-sm font-medium">{lead.probability}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          )
        })}
      </div>

      {filteredLeads.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No leads found matching your criteria</p>
          {hasActiveFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* New Lead Form */}
      <LeadForm
        open={showNewLeadForm}
        onClose={() => setShowNewLeadForm(false)}
        onSave={createLead}
      />

      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          setImportOpen(false)
          refetch()
        }}
      />

      {/* Edit Lead Modal */}
      <DealModal
        lead={selectedLead}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedLead(null)
        }}
        onSave={updateLead}
        onDelete={isAdmin ? deleteLead : undefined}
        onExpiryChanged={refetchExpiry}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected leads to trash. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
