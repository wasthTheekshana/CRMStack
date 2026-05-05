import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Lead } from '@/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { getRiskLevel } from '@/config/constants'
import { useStageColor } from '@/store/tenantStore'

interface Props {
  open: boolean
  solution: string
  leads: Lead[]
  onClose: () => void
}

export function SolutionLeadsSheet({ open, solution, leads, onClose }: Props) {
  const getStageColor = useStageColor()
  const total = leads.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[440px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{solution}</SheetTitle>
          <SheetDescription>
            {leads.length} {leads.length === 1 ? 'lead' : 'leads'} · Total: {formatCurrency(total)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No leads found for this solution.
            </p>
          ) : (
            leads.map((lead) => {
              const risk = getRiskLevel(lead.probability)
              const stageColor = getStageColor(lead.salesStage)
              return (
                <div
                  key={lead.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{lead.companyName}</span>
                    <Badge
                      className="flex-shrink-0 text-white text-[10px] px-1.5 py-0"
                      style={{ backgroundColor: stageColor }}
                    >
                      {lead.salesStage}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-green-700">
                      {formatCurrency(lead.estimatedRevenue)}
                    </span>
                    <div
                      className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"
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
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate" title={lead.ownerEmail}>{lead.ownerEmail}</p>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
