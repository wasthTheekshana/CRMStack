import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Save, Trash2, UserPlus, Star, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Lead, SalesStage, Contact } from '@/types'
import { useSalesStages, useSolutions, useDefaultProbability } from '@/store/tenantStore'
import { useIsAdmin } from '@/store/authStore'
import { ReassignOwnerSelect } from '@/components/leads/ReassignOwnerSelect'

import { cn } from '@/lib/utils/cn'

const dealSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  solution: z.string().min(1, 'Solution is required'),
  salesStage: z.string(),
  imageCount: z.coerce.number().min(0),
  boxCount: z.coerce.number().min(0),
  estimatedRevenue: z.coerce.number().min(0),
  probability: z.coerce.number().min(0).max(100),
  remarks: z.string(),
  hoUpdate: z.string(),
})

type DealFormData = z.infer<typeof dealSchema>

interface DealModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onSave: (id: string, data: Partial<Lead>) => Promise<unknown>
  onDelete?: (id: string) => Promise<unknown>
}

// Generate unique ID for contacts
const generateContactId = () => `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export function DealModal({
  lead,
  open,
  onClose,
  onSave,
  onDelete,
}: DealModalProps) {
  const salesStages      = useSalesStages()
  const solutions        = useSolutions()
  const getDefaultProb   = useDefaultProbability()
  const isAdmin          = useIsAdmin()

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [ownerState, setOwnerState] = useState<{ ownerId: string; ownerEmail: string } | null>(null)

  // Sync local owner state when lead changes
  useEffect(() => {
    if (lead) {
      setOwnerState({ ownerId: lead.ownerId, ownerEmail: lead.ownerEmail })
    } else {
      setOwnerState(null)
    }
  }, [lead])

  // Initialize contacts when lead changes
  useEffect(() => {
    if (lead) {
      if (lead.contacts && lead.contacts.length > 0) {
        setContacts(lead.contacts)
      } else if (lead.contactName) {
        // Legacy: convert single contact to array
        setContacts([{
          id: generateContactId(),
          name: lead.contactName,
          phone: lead.contactNumber || '',
          isPrimary: true
        }])
      } else {
        setContacts([{ id: generateContactId(), name: '', phone: '', isPrimary: true }])
      }
    }
  }, [lead])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      companyName: '',
      solution: '',
      salesStage: 'Meeting Pending',
      imageCount: 0,
      boxCount: 0,
      estimatedRevenue: 0,
      probability: 25,
      remarks: '',
      hoUpdate: '',
    },
  })

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      reset({
        companyName: lead.companyName,
        solution: lead.solution,
        salesStage: lead.salesStage,
        imageCount: lead.imageCount,
        boxCount: lead.boxCount,
        estimatedRevenue: lead.estimatedRevenue,
        probability: lead.probability,
        remarks: lead.remarks || '',
        hoUpdate: lead.hoUpdate || '',
      })
    }
  }, [lead, reset])

  const probability = watch('probability')
  const salesStage = watch('salesStage')
  const estimatedRevenue = watch('estimatedRevenue')

  const addContact = () => {
    setContacts([
      ...contacts,
      { id: generateContactId(), name: '', phone: '', email: '', designation: '', isPrimary: false }
    ])
  }

  const removeContact = (id: string) => {
    if (contacts.length === 1) return
    const newContacts = contacts.filter(c => c.id !== id)
    if (!newContacts.some(c => c.isPrimary) && newContacts.length > 0) {
      newContacts[0].isPrimary = true
    }
    setContacts(newContacts)
  }

  const updateContact = (id: string, field: keyof Contact, value: string | boolean) => {
    setContacts(contacts.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value }
      }
      if (field === 'isPrimary' && value === true) {
        return { ...c, isPrimary: c.id === id }
      }
      return c
    }))
  }

  const onSubmit = async (data: DealFormData) => {
    if (!lead) return

    setValidationError(null)

    // Validate: Proposal Sent stage requires Estimated Revenue > 0
    if (data.salesStage === 'Proposal Sent' && (!data.estimatedRevenue || data.estimatedRevenue <= 0)) {
      setValidationError('Estimated Revenue must be greater than 0 for Proposal Sent stage')
      return
    }

    // Validate at least one contact
    const validContacts = contacts.filter(c => c.name.trim() !== '')
    if (validContacts.length === 0) {
      setValidationError('At least one contact with a name is required')
      return
    }

    setIsLoading(true)
    try {
      // Clean contacts: replace undefined values with empty strings to prevent Firestore errors
      const cleanedContacts = validContacts.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || '',
        designation: c.designation || '',
        isPrimary: c.isPrimary,
      }))

      await onSave(lead.id, {
        companyName: data.companyName,
        solution: data.solution,
        salesStage: data.salesStage as SalesStage,
        imageCount: data.imageCount,
        boxCount: data.boxCount,
        estimatedRevenue: data.estimatedRevenue,
        probability: data.probability,
        remarks: data.remarks || '',
        hoUpdate: data.hoUpdate || '',
        contacts: cleanedContacts,
        ownerId: ownerState?.ownerId ?? lead.ownerId,
        ownerEmail: ownerState?.ownerEmail ?? lead.ownerEmail,
      })
      toast.success('Deal updated successfully')
      onClose()
    } catch (error: unknown) {
      console.error('Error saving deal:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to update deal: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!lead || !onDelete) return

    if (!confirm('Are you sure you want to delete this deal?')) return

    setIsDeleting(true)
    try {
      await onDelete(lead.id)
      toast.success('Deal deleted successfully')
      onClose()
    } catch (error: unknown) {
      console.error('Error deleting deal:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to delete deal: ${errorMessage}`)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                {...register('companyName')}
                disabled={isLoading}
              />
              {errors.companyName && (
                <p className="text-xs text-red-500">{errors.companyName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="solution">Solution *</Label>
              <Select
                value={watch('solution')}
                onValueChange={(value) => setValue('solution', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select solution" />
                </SelectTrigger>
                <SelectContent>
                  {solutions.map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Contacts</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContact}
                disabled={isLoading}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {contacts.map((contact) => (
                <Card key={contact.id} className={cn(
                  'relative',
                  contact.isPrimary && 'ring-2 ring-primary'
                )}>
                  <CardContent className="p-3">
                    {contact.isPrimary && (
                      <span className="absolute -top-2 left-3 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Input
                        value={contact.name}
                        onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                        placeholder="Name"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                      <Input
                        value={contact.phone}
                        onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                        placeholder="Phone"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                      <Input
                        value={contact.email || ''}
                        onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                        placeholder="Email"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                      <Input
                        value={contact.designation || ''}
                        onChange={(e) => updateContact(contact.id, 'designation', e.target.value)}
                        placeholder="Designation"
                        disabled={isLoading}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      {!contact.isPrimary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateContact(contact.id, 'isPrimary', true)}
                          disabled={isLoading}
                          className="h-6 text-xs px-2"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Primary
                        </Button>
                      )}
                      {contacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContact(contact.id)}
                          disabled={isLoading}
                          className="h-6 text-xs px-2 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salesStage">Sales Stage</Label>
              <Select
                value={watch('salesStage')}
                onValueChange={(value) => {
                  setValue('salesStage', value)
                  setValue('probability', getDefaultProb(value as SalesStage))
                  setValidationError(null)
                }}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {salesStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.name}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedRevenue" className={cn(
                salesStage === 'Proposal Sent' && 'text-primary font-medium'
              )}>
                Estimated Revenue (LKR) {salesStage === 'Proposal Sent' && '*'}
              </Label>
              <Input
                id="estimatedRevenue"
                type="number"
                {...register('estimatedRevenue')}
                disabled={isLoading}
                className={cn(
                  salesStage === 'Proposal Sent' && (!estimatedRevenue || estimatedRevenue <= 0) && 'border-red-500'
                )}
              />
              {salesStage === 'Proposal Sent' && (
                <p className="text-xs text-muted-foreground">
                  Required for Proposal Sent stage
                </p>
              )}
            </div>

            <div className="space-y-2 col-span-2">
              <div className="flex items-center justify-between">
                <Label>Probability</Label>
                <span className="text-sm font-medium">{probability}%</span>
              </div>
              <Slider
                value={[probability || 0]}
                onValueChange={([value]) => setValue('probability', value)}
                max={100}
                step={5}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageCount">Image Count</Label>
              <Input
                id="imageCount"
                type="number"
                {...register('imageCount')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="boxCount">Box Count</Label>
              <Input
                id="boxCount"
                type="number"
                {...register('boxCount')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                {...register('remarks')}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="hoUpdate">H/O Update</Label>
              <Input
                id="hoUpdate"
                {...register('hoUpdate')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Owner</Label>
              {isAdmin ? (
                <ReassignOwnerSelect
                  leadId={lead.id}
                  currentOwnerId={ownerState?.ownerId ?? lead.ownerId}
                  onReassigned={(updated) => {
                    // ReassignOwnerSelect already persisted the change; sync display state.
                    setOwnerState({ ownerId: updated.ownerId, ownerEmail: updated.ownerEmail })
                  }}
                />
              ) : (
                <span className="text-sm text-muted-foreground py-1">
                  {ownerState?.ownerEmail ?? lead.ownerEmail}
                </span>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading || isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span className="ml-2">Delete</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="ml-2">Save Changes</span>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
