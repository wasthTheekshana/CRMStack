import { useState, useEffect, useMemo } from 'react'
import { Plus, Loader2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { LeadForm } from '@/components/leads/LeadForm'
import { useLeads } from '@/hooks/useLeads'
import { useIsAdmin } from '@/store/authStore'
import { getSalesUsers } from '@/lib/api/collections'
import { User } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export function PipelinePage() {
  const [showNewLeadForm, setShowNewLeadForm] = useState(false)
  const { leads, isLoading, updateLeadStage, updateLead, deleteLead, createLead, updateLeadPosition } = useLeads()
  const isAdmin = useIsAdmin()
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('all')

  // Fetch sales users on mount (only for admin)
  useEffect(() => {
    if (!isAdmin) return
    const fetchSalesUsers = async () => {
      try {
        const users = await getSalesUsers()
        setSalesUsers(users)
      } catch (error) {
        console.error('Error fetching sales users:', error)
      }
    }
    fetchSalesUsers()
  }, [isAdmin])

  // Filter leads by selected salesperson
  const filteredLeads = useMemo(() => {
    if (!isAdmin || selectedSalesPerson === 'all') {
      return leads
    }
    return leads.filter(lead => lead.ownerId === selectedSalesPerson)
  }, [leads, selectedSalesPerson, isAdmin])

  // Get selected salesperson name for display
  const selectedSalesPersonName = useMemo(() => {
    if (selectedSalesPerson === 'all') return 'All Sales Reps'
    const user = salesUsers.find(u => u.uid === selectedSalesPerson)
    return user?.displayName || 'Unknown'
  }, [selectedSalesPerson, salesUsers])

  // Calculate stats for the selected filter
  const pipelineStats = useMemo(() => {
    const totalDeals = filteredLeads.length
    const totalRevenue = filteredLeads.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)
    const weightedRevenue = filteredLeads.reduce(
      (sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100,
      0
    )
    return { totalDeals, totalRevenue, weightedRevenue }
  }, [filteredLeads])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Drag and drop deals to update their stage
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Salesperson Filter - Admin only */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedSalesPerson} onValueChange={setSelectedSalesPerson}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Reps</SelectItem>
                  {salesUsers.map((user) => (
                    <SelectItem key={user.uid} value={user.uid}>
                      {user.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={() => setShowNewLeadForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </div>
      </div>

      {/* Active Filter Badge & Stats */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedSalesPerson !== 'all' && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <Filter className="h-3 w-3" />
                  {selectedSalesPersonName}
                </Badge>
                <button
                  onClick={() => setSelectedSalesPerson('all')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear filter
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Deals:</span>
              <span className="font-semibold">{pipelineStats.totalDeals}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Pipeline:</span>
              <span className="font-semibold text-blue-600">{formatCurrency(pipelineStats.totalRevenue)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Weighted:</span>
              <span className="font-semibold text-green-600">{formatCurrency(pipelineStats.weightedRevenue)}</span>
            </div>
          </div>
        </div>
      )}

      <KanbanBoard
        leads={filteredLeads}
        onStageChange={updateLeadStage}
        onLeadUpdate={updateLead}
        onLeadDelete={deleteLead}
        onPositionChange={async (leadId, newPosition) => {
          await updateLeadPosition(leadId, newPosition)
        }}
      />

      <LeadForm
        open={showNewLeadForm}
        onClose={() => setShowNewLeadForm(false)}
        onSave={createLead}
      />
    </div>
  )
}
