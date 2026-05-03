import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Trash2,
  Target,
  Trophy,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/store/authStore'
import { SalesTarget } from '@/types'
import {
  getSalesTargets,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
} from '@/lib/api/collections'
import { formatCurrency } from '@/config/constants'
import { cn } from '@/lib/utils/cn'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 1, currentYear, currentYear + 1]

export function SalesTargetsPage() {
  const { user, userProfile } = useAuthStore()
  const [targets, setTargets] = useState<SalesTarget[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formYear, setFormYear] = useState(currentYear)
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1)
  const [formTarget, setFormTarget] = useState('')
  const [formAchievement, setFormAchievement] = useState('')

  // Load targets
  useEffect(() => {
    if (!user) return

    const loadTargets = async () => {
      setIsLoading(true)
      try {
        const data = await getSalesTargets()
        setTargets(data)
      } catch (error) {
        console.error('Error loading targets:', error)
        toast.error('Failed to load targets')
      } finally {
        setIsLoading(false)
      }
    }

    loadTargets()
  }, [user, selectedYear])

  const filteredTargets = useMemo(
    () => targets.filter(t => t.year === selectedYear),
    [targets, selectedYear]
  )

  // Calculate summary stats for the selected year only
  const summary = useMemo(() => {
    const totalTarget = filteredTargets.reduce((sum, t) => sum + t.target, 0)
    const totalAchievement = filteredTargets.reduce((sum, t) => sum + t.achievement, 0)
    const variance = totalAchievement - totalTarget
    const percentage = totalTarget > 0 ? (totalAchievement / totalTarget) * 100 : 0

    return { totalTarget, totalAchievement, variance, percentage }
  }, [filteredTargets])

  const openCreateModal = () => {
    setEditingTarget(null)
    setFormYear(selectedYear)
    setFormMonth(new Date().getMonth() + 1)
    setFormTarget('')
    setFormAchievement('')
    setModalOpen(true)
  }

  const openEditModal = (target: SalesTarget) => {
    setEditingTarget(target)
    setFormYear(target.year)
    setFormMonth(target.month)
    setFormTarget(target.target.toString())
    setFormAchievement(target.achievement.toString())
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!user || !userProfile) return

    const target = parseFloat(formTarget) || 0
    const achievement = parseFloat(formAchievement) || 0

    if (target <= 0) {
      toast.error('Please enter a valid target amount')
      return
    }

    setIsSaving(true)
    try {
      if (editingTarget) {
        // Update existing
        await updateSalesTarget(editingTarget.id, {
          year: formYear,
          month: formMonth,
          target,
          achievement,
        })
        toast.success('Target updated successfully')
      } else {
        // Create new
        await createSalesTarget({
          year: formYear,
          month: formMonth,
          target,
          achievement,
          ownerId:   user.id,
          ownerEmail: userProfile.email,
          ownerName:  userProfile.displayName,
        })
        toast.success('Target created successfully')
      }

      // Reload targets
      const data = await getSalesTargets()
      setTargets(data)
      setModalOpen(false)
    } catch (error: unknown) {
      console.error('Error saving target:', error)
      const message = error instanceof Error ? error.message : 'Failed to save target'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (target: SalesTarget) => {
    if (!confirm('Are you sure you want to delete this target?')) return

    try {
      await deleteSalesTarget(target.id)
      toast.success('Target deleted successfully')
      setTargets(targets.filter(t => t.id !== target.id))
    } catch (error) {
      console.error('Error deleting target:', error)
      toast.error('Failed to delete target')
    }
  }

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Targets</h1>
          <p className="text-sm text-muted-foreground">
            Track your monthly targets and achievements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Target
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalTarget)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Total Achievement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(summary.totalAchievement)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {getVarianceIcon(summary.variance)}
              Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              'text-2xl font-bold',
              summary.variance >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {summary.variance >= 0 ? '+' : ''}{formatCurrency(summary.variance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Achievement %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold', getPercentageColor(summary.percentage))}>
              {summary.percentage.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Targets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown - {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTargets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No targets set for {selectedYear}. Click "Add Target" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Achievement</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTargets.map((target) => {
                  const variance = target.achievement - target.target
                  const percentage = target.target > 0
                    ? (target.achievement / target.target) * 100
                    : 0

                  return (
                    <TableRow key={target.id}>
                      <TableCell className="font-medium">
                        {MONTHS[target.month - 1]}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(target.target)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(target.achievement)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'flex items-center justify-end gap-1',
                          variance >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {getVarianceIcon(variance)}
                          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                        </span>
                      </TableCell>
                      <TableCell className={cn('text-right font-medium', getPercentageColor(percentage))}>
                        {percentage.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(target)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(target)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTarget ? 'Edit Target' : 'Add New Target'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={formYear.toString()}
                  onValueChange={(value) => setFormYear(parseInt(value))}
                  disabled={!!editingTarget}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={formMonth.toString()}
                  onValueChange={(value) => setFormMonth(parseInt(value))}
                  disabled={!!editingTarget}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={index} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sales Target (LKR)</Label>
              <Input
                type="number"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                placeholder="Enter target amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Achievement (LKR)</Label>
              <Input
                type="number"
                value={formAchievement}
                onChange={(e) => setFormAchievement(e.target.value)}
                placeholder="Enter achievement amount"
              />
            </div>

            {formTarget && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Preview:</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <span>Variance:</span>
                  <span className={cn(
                    'font-medium',
                    (parseFloat(formAchievement) || 0) >= (parseFloat(formTarget) || 0)
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}>
                    {formatCurrency((parseFloat(formAchievement) || 0) - (parseFloat(formTarget) || 0))}
                  </span>
                  <span>Percentage:</span>
                  <span className="font-medium">
                    {((parseFloat(formAchievement) || 0) / (parseFloat(formTarget) || 1) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingTarget ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
