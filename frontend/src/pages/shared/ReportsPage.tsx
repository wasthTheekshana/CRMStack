import { useState, useMemo } from 'react'
import { Loader2, Download, FileText, Filter, X, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useLeads } from '@/hooks/useLeads'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'
import { exportToCSV, exportToPDF } from '@/lib/utils/exporters'
import { SalesStage } from '@/types'
import { useSalesStages, useStageColor } from '@/store/tenantStore'

export function ReportsPage() {
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [solutionFilter, setSolutionFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { leads, isLoading } = useLeads()
  const salesStages = useSalesStages()
  const getStageColor = useStageColor()

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
    return leads.filter((lead) => {
      // Get primary contact name or first contact name
      const primaryContact = lead.contacts?.find(c => c.isPrimary) || lead.contacts?.[0]
      const contactName = primaryContact?.name || lead.contactName || ''

      const matchesSearch =
        searchTerm === '' ||
        lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contactName.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStage = stageFilter === 'all' || lead.salesStage === stageFilter
      const matchesSolution = solutionFilter === 'all' || lead.solution === solutionFilter

      return matchesSearch && matchesStage && matchesSolution
    })
  }, [leads, searchTerm, stageFilter, solutionFilter])

  // Calculate totals
  const totals = useMemo(() => {
    return {
      count: filteredLeads.length,
      revenue: filteredLeads.reduce((sum, l) => sum + l.estimatedRevenue, 0),
      weighted: filteredLeads.reduce(
        (sum, l) => sum + (l.estimatedRevenue * l.probability) / 100,
        0
      ),
      avgProbability:
        filteredLeads.length > 0
          ? filteredLeads.reduce((sum, l) => sum + l.probability, 0) / filteredLeads.length
          : 0,
    }
  }, [filteredLeads])

  const hasActiveFilters = stageFilter !== 'all' || solutionFilter !== 'all' || searchTerm !== ''

  const clearFilters = () => {
    setSearchTerm('')
    setStageFilter('all')
    setSolutionFilter('all')
  }

  const handleExportCSV = () => {
    exportToCSV(filteredLeads, 'leads-report')
  }

  const handleExportPDF = () => {
    exportToPDF(filteredLeads, 'Sales Report', {
      stage: stageFilter !== 'all' ? (stageFilter as SalesStage) : undefined,
      solution: solutionFilter !== 'all' ? solutionFilter : undefined,
    })
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
          <h1 className="text-xl md:text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and export custom reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} size="sm" className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Export </span>CSV
          </Button>
          <Button onClick={handleExportPDF} size="sm" className="flex-1 sm:flex-none">
            <FileText className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Export </span>PDF
          </Button>
        </div>
      </div>

      {/* Mobile Search and Filter */}
      <div className="flex gap-2 md:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
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
                <Label>Sales Stage</Label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {salesStages.map((stage) => (
                      <SelectItem key={stage.name} value={stage.name}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Solution</Label>
                <Select value={solutionFilter} onValueChange={setSolutionFilter}>
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

      {/* Desktop Filters */}
      <Card className="hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                placeholder="Search company or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sales Stage</Label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {salesStages.map((stage) => (
                    <SelectItem key={stage.name} value={stage.name}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Solution</Label>
              <Select value={solutionFilter} onValueChange={setSolutionFilter}>
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
            <div className="flex items-end">
              <Button variant="ghost" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary - responsive grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Total Records</p>
            <p className="text-xl md:text-2xl font-bold">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-xl md:text-2xl font-bold">{formatCompactNumber(totals.revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Weighted Revenue</p>
            <p className="text-xl md:text-2xl font-bold">{formatCompactNumber(totals.weighted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Avg Probability</p>
            <p className="text-xl md:text-2xl font-bold">{totals.avgProbability.toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Report Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 md:py-3 px-3 md:px-4">Company</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 hidden sm:table-cell">Solution</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 hidden lg:table-cell">Contact</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4">Stage</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4">Revenue</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4">Prob</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4 hidden md:table-cell">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 md:py-3 px-3 md:px-4 font-medium">
                      <div className="truncate max-w-[120px] md:max-w-none">{lead.companyName}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{lead.solution}</div>
                    </td>
                    <td className="py-2 md:py-3 px-3 md:px-4 hidden sm:table-cell">{lead.solution}</td>
                    <td className="py-2 md:py-3 px-3 md:px-4 hidden lg:table-cell">{lead.contactName}</td>
                    <td className="py-2 md:py-3 px-3 md:px-4">
                      <Badge
                        variant="outline"
                        className="text-[10px] md:text-xs"
                        style={{
                          backgroundColor: `${getStageColor(lead.salesStage)}20`,
                          borderColor: getStageColor(lead.salesStage),
                          color: getStageColor(lead.salesStage),
                        }}
                      >
                        {lead.salesStage}
                      </Badge>
                    </td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-right">
                      <span className="hidden md:inline">{formatCurrency(lead.estimatedRevenue)}</span>
                      <span className="md:hidden">{formatCompactNumber(lead.estimatedRevenue)}</span>
                    </td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-right">{lead.probability}%</td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-right hidden md:table-cell">
                      {formatCurrency((lead.estimatedRevenue * lead.probability) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No records match your filter criteria</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
