import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Building2, DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Lead } from '@/types'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'
import { getRiskLevel } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import { useIsAdmin } from '@/store/authStore'
import { ReassignOwnerSelect } from '@/components/leads/ReassignOwnerSelect'

interface KanbanCardProps {
  lead: Lead
  onClick: () => void
  onLeadUpdated?: (updated: { id: string; ownerId: string; ownerEmail: string }) => void
}

export function KanbanCard({ lead, onClick, onLeadUpdated }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const risk = getRiskLevel(lead.probability)
  const isAdmin = useIsAdmin()
  const [popoverOpen, setPopoverOpen] = useState(false)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={() => { setPopoverOpen(false); onClick(); }}
    >
      <CardContent className="p-2.5 md:p-3">
        <div className="flex items-start gap-1.5 md:gap-2">
          <button
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex items-center gap-1 min-w-0">
                <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-xs md:text-sm truncate">
                  {lead.companyName}
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] md:text-xs flex-shrink-0 px-1.5 py-0"
                style={{
                  backgroundColor: `${risk.color}20`,
                  borderColor: risk.color,
                  color: risk.color,
                }}
              >
                {lead.probability}%
              </Badge>
            </div>

            {lead.solution && (
              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate">
                {lead.solution}
              </p>
            )}

            <div className="flex items-center justify-between mt-1.5 md:mt-2">
              <div className="flex items-center gap-1 text-xs md:text-sm font-semibold">
                <DollarSign className="h-3 w-3 text-green-600" />
                <span className="hidden sm:inline">{formatCurrency(lead.estimatedRevenue)}</span>
                <span className="sm:hidden">{formatCompactNumber(lead.estimatedRevenue)}</span>
              </div>
              <div
                className="h-1.5 w-12 md:w-16 bg-muted rounded-full overflow-hidden"
                title={`${lead.probability}% probability`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${lead.probability}%`,
                    backgroundColor: risk.color,
                  }}
                />
              </div>
            </div>

            <div
              className="mt-1.5 md:mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              {isAdmin ? (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] md:text-xs text-muted-foreground hover:bg-muted/80 transition-colors max-w-full truncate">
                      {lead.ownerEmail}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <p className="text-xs font-medium mb-2">Reassign Owner</p>
                    <ReassignOwnerSelect
                      leadId={lead.id}
                      currentOwnerId={lead.ownerId}
                      onReassigned={(updated) => {
                        setPopoverOpen(false)
                        onLeadUpdated?.(updated)
                      }}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] md:text-xs text-muted-foreground max-w-full truncate">
                  {lead.ownerEmail}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
