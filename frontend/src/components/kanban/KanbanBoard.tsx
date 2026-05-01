import { useState, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { AlertCircle, X } from 'lucide-react'
import { Lead, SalesStage } from '@/types'
import { useSalesStages } from '@/store/tenantStore'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { DealModal } from './DealModal'
import { Button } from '@/components/ui/button'

interface KanbanBoardProps {
  leads: Lead[]
  onStageChange: (leadId: string, newStage: SalesStage) => Promise<unknown>
  onLeadUpdate: (leadId: string, data: Partial<Lead>) => Promise<unknown>
  onLeadDelete?: (leadId: string) => Promise<unknown>
  onPositionChange?: (leadId: string, newPosition: number, stage: SalesStage) => Promise<unknown>
}

export function KanbanBoard({
  leads: leadsProp,
  onStageChange,
  onLeadUpdate,
  onLeadDelete,
  onPositionChange,
}: KanbanBoardProps) {
  const salesStages = useSalesStages()
  const [leads, setLeads] = useState<Lead[]>(leadsProp)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [stageError, setStageError] = useState<{ leadName: string; message: string } | null>(null)

  // Keep local leads in sync when the parent refetches
  useEffect(() => {
    setLeads(leadsProp)
  }, [leadsProp])

  const handleLeadUpdated = (updated: { id: string; ownerId: string; ownerEmail: string }) => {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Group leads by stage and sort by position (lower position = higher priority, then by updatedAt)
  const leadsByStage = salesStages.reduce(
    (acc, stage) => {
      const stageLeads = leads.filter((lead) => lead.salesStage === stage.name)
      // Sort by position first (if exists), then by updatedAt descending
      acc[stage.name] = stageLeads.sort((a, b) => {
        // If both have positions, sort by position
        if (a.position !== undefined && b.position !== undefined) {
          return a.position - b.position
        }
        // If only one has position, it comes first
        if (a.position !== undefined) return -1
        if (b.position !== undefined) return 1
        // Otherwise sort by updatedAt descending (newest first)
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
      return acc
    },
    {} as Record<string, Lead[]>
  )

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const leadId = active.id as string
    const overId = over.id as string

    // Find the dragged lead
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return

    // Determine the target stage
    // Check if over.id is a stage ID or a lead ID
    const validStageIds = salesStages.map(s => s.name)
    let newStage: SalesStage
    let targetLead: Lead | undefined

    if (validStageIds.includes(overId)) {
      // Dropped directly on a column
      newStage = overId as SalesStage
    } else {
      // Dropped on another lead card - find that lead's stage
      targetLead = leads.find((l) => l.id === overId)
      if (!targetLead) return
      newStage = targetLead.salesStage
    }

    // Check if this is a vertical reorder within the same column
    if (lead.salesStage === newStage && targetLead && leadId !== overId) {
      // Same stage - handle vertical reordering
      const stageLeads = leadsByStage[newStage]
      const oldIndex = stageLeads.findIndex((l) => l.id === leadId)
      const newIndex = stageLeads.findIndex((l) => l.id === overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Reorder the leads and update positions
        const reorderedLeads = arrayMove(stageLeads, oldIndex, newIndex)

        // Update positions for all affected leads
        if (onPositionChange) {
          try {
            // Update the moved lead's position
            await onPositionChange(leadId, newIndex, newStage)

            // Update positions of other affected leads
            for (let i = 0; i < reorderedLeads.length; i++) {
              if (reorderedLeads[i].id !== leadId) {
                await onPositionChange(reorderedLeads[i].id, i, newStage)
              }
            }
            toast.success('Card reordered')
          } catch (error) {
            console.error('Error reordering cards:', error)
            toast.error('Failed to reorder. Please try again.')
          }
        }
      }
      return
    }

    // Stage change (horizontal move)
    if (lead.salesStage !== newStage) {
      // Validate: Proposal Sent stage requires Estimated Revenue > 0
      if (newStage === 'Proposal Sent' && (!lead.estimatedRevenue || lead.estimatedRevenue <= 0)) {
        setStageError({
          leadName: lead.companyName,
          message: 'Cannot move to Proposal Sent stage. Estimated Revenue must be greater than 0.',
        })
        return
      }

      // Clear any previous error
      setStageError(null)
      try {
        await onStageChange(leadId, newStage)
        toast.success(`Moved to ${newStage}`)
      } catch (error) {
        console.error('Error changing stage:', error)
        toast.error('Failed to update stage. Please try again.')
      }
    }
  }

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedLead(null)
  }

  return (
    <>
      {/* Stage Change Error Banner */}
      {stageError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">{stageError.leadName}</p>
            <p className="text-sm text-red-600">{stageError.message}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStageError(null)}
            className="text-red-500 hover:text-red-700 hover:bg-red-100 -mt-1 -mr-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {salesStages.map((stage) => (
            <KanbanColumn
              key={stage.name}
              stage={stage}
              leads={leadsByStage[stage.name] || []}
              onLeadClick={handleLeadClick}
              onLeadUpdated={handleLeadUpdated}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="w-72 opacity-80">
              <KanbanCard lead={activeLead} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <DealModal
        lead={selectedLead}
        open={modalOpen}
        onClose={handleModalClose}
        onSave={onLeadUpdate}
        onDelete={onLeadDelete}
      />
    </>
  )
}
