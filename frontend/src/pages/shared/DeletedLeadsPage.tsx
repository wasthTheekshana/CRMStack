import { useState, useEffect } from 'react'
import { Loader2, Trash2, Building2, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lead } from '@/types'
import { getDeletedLeads } from '@/lib/api/collections'
import { formatCurrency } from '@/lib/utils/formatters'
import { useAuthStore, useIsAdmin } from '@/store/authStore'
import { useStageColor } from '@/store/tenantStore'

function formatDeletedDate(timestamp: string | undefined): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DeletedLeadsPage() {
  const [deletedLeads, setDeletedLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isAdmin = useIsAdmin()
  const { user } = useAuthStore()
  const getStageColor = useStageColor()

  useEffect(() => {
    const fetchDeleted = async () => {
      try {
        setIsLoading(true)
        // Backend already filters by role (admin=all, sales=own)
        const leads = await getDeletedLeads()
        setDeletedLeads(leads)
      } catch (error) {
        console.error('Error fetching deleted leads:', error)
      } finally {
        setIsLoading(false)
      }
    }
    if (user) fetchDeleted()
  }, [user, isAdmin])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-muted-foreground" />
          Deleted Leads
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? 'All deleted leads across all sales representatives'
            : 'Leads you have deleted'}
        </p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{deletedLeads.length}</p>
            <p className="text-sm text-muted-foreground">Total Deleted Leads</p>
          </div>
        </CardContent>
      </Card>

      {deletedLeads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground">No deleted leads found.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Deleted Leads Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6 md:pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4">Company</th>
                    <th className="text-left py-3 px-4 hidden sm:table-cell">Solution</th>
                    <th className="text-left py-3 px-4">Stage</th>
                    <th className="text-right py-3 px-4 hidden md:table-cell">Revenue</th>
                    <th className="text-right py-3 px-4 hidden md:table-cell">Probability</th>
                    {isAdmin && (
                      <th className="text-left py-3 px-4 hidden lg:table-cell">Owner</th>
                    )}
                    <th className="text-left py-3 px-4">Deleted On</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-muted/20">
                      {/* Company */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="font-medium">{lead.companyName}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{lead.solution}</p>
                          </div>
                        </div>
                      </td>

                      {/* Solution */}
                      <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">
                        {lead.solution}
                      </td>

                      {/* Stage badge */}
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: getStageColor(lead.salesStage),
                            color: getStageColor(lead.salesStage),
                          }}
                        >
                          {lead.salesStage}
                        </Badge>
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-4 text-right hidden md:table-cell font-medium">
                        {formatCurrency(lead.estimatedRevenue)}
                      </td>

                      {/* Probability */}
                      <td className="py-3 px-4 text-right hidden md:table-cell">
                        <span
                          className={
                            lead.probability >= 60
                              ? 'text-green-600 font-medium'
                              : lead.probability >= 30
                              ? 'text-yellow-600 font-medium'
                              : 'text-red-600 font-medium'
                          }
                        >
                          {lead.probability}%
                        </span>
                      </td>

                      {/* Owner (admin only) */}
                      {isAdmin && (
                        <td className="py-3 px-4 hidden lg:table-cell text-muted-foreground text-xs">
                          {lead.ownerEmail}
                        </td>
                      )}

                      {/* Deleted date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span className="text-xs">{formatDeletedDate(lead.deletedAt)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
