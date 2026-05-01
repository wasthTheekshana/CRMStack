import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Lead } from '@/types'
import { ExpiryMap } from '@/services/leadExpiryService'
import { KanbanCard } from './KanbanCard'
import { formatCompactNumber } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'

interface KanbanColumnProps {
  stage: {
    name: string   // used as droppable ID and display label
    color: string
  }
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
  onLeadUpdated: (updated: { id: string; ownerId: string; ownerEmail: string }) => void
  expiryMap: ExpiryMap
}

export function KanbanColumn({ stage, leads, onLeadClick, onLeadUpdated, expiryMap }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.name,
  })

  const totalRevenue = leads.reduce((sum, l) => sum + l.estimatedRevenue, 0)

  return (
    <div className="flex-shrink-0 w-64 md:w-72">
      {/* Column Header */}
      <div
        className="p-2 md:p-3 rounded-t-lg"
        style={{ backgroundColor: `${stage.color}15` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <span className="font-semibold text-xs md:text-sm">{stage.name}</span>
          </div>
          <span className="text-xs md:text-sm font-medium text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
            {leads.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatCompactNumber(totalRevenue)} pipeline
        </p>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[300px] md:min-h-[400px] p-1.5 md:p-2 bg-muted/30 rounded-b-lg border border-t-0 space-y-2 overflow-y-auto',
          'max-h-[calc(100vh-280px)] md:max-h-[calc(100vh-300px)]',
          'touch-pan-y', // Better touch scrolling
          isOver && 'bg-primary/5 border-primary/30'
        )}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              onLeadUpdated={onLeadUpdated}
              expiryMap={expiryMap}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 md:h-24 text-xs md:text-sm text-muted-foreground">
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  )
}
