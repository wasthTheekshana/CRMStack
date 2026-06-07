import { useState } from 'react'
import { CompanyPicker } from './CompanyPicker'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, UserPlus, Star } from 'lucide-react'
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
import { LeadFormData, SalesStage, Contact } from '@/types'
import { useSalesStages, useSolutions, useDefaultProbability, useCustomFields, useVisibleFields } from '@/store/tenantStore'
import type { CustomFieldConfig } from '@/store/tenantStore'
import { cn } from '@/lib/utils/cn'

const leadSchema = z.object({
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

type FormData = z.infer<typeof leadSchema>

interface LeadFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: LeadFormData) => Promise<unknown>
}

// Generate unique ID for contacts
const generateContactId = () => `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export function LeadForm({ open, onClose, onSave }: LeadFormProps) {
  const salesStages    = useSalesStages()
  const solutions      = useSolutions()
  const getDefaultProb = useDefaultProbability()
  const customFields   = useCustomFields()
  const visibleFields  = useVisibleFields()
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})

  const [companyId, setCompanyId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([
    { id: generateContactId(), name: '', phone: '', email: '', designation: '', isPrimary: true }
  ])
  const [contactError, setContactError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(leadSchema),
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

  const probability = watch('probability')

  const addContact = () => {
    setContacts([
      ...contacts,
      { id: generateContactId(), name: '', phone: '', email: '', designation: '', isPrimary: false }
    ])
  }

  const removeContact = (id: string) => {
    if (contacts.length === 1) return
    const newContacts = contacts.filter(c => c.id !== id)
    // Ensure at least one is primary
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
      // If setting primary, unset others
      if (field === 'isPrimary' && value === true) {
        return { ...c, isPrimary: c.id === id }
      }
      return c
    }))
    setContactError(null)
  }

  const onSubmit = async (data: FormData) => {
    // Validate at least one contact has a name
    const hasValidContact = contacts.some(c => c.name.trim() !== '')
    if (!hasValidContact) {
      setContactError('At least one contact with a name is required')
      return
    }

    // Filter out empty contacts
    const validContacts = contacts.filter(c => c.name.trim() !== '')

    // Validate required custom fields
    for (const cf of customFields) {
      if (cf.required && !customFieldValues[cf.id]?.trim()) {
        toast.error(`"${cf.name}" is required`)
        return
      }
    }

    setIsLoading(true)
    try {
      await onSave({
        ...data,
        companyId: companyId || undefined,
        contacts: validContacts,
        salesStage: data.salesStage as SalesStage,
        customFields: customFieldValues,
      })
      toast.success('Lead created successfully')
      reset()
      setCompanyId('')
      setCustomFieldValues({})
      setContacts([{ id: generateContactId(), name: '', phone: '', email: '', designation: '', isPrimary: true }])
      onClose()
    } catch (error) {
      console.error('Error creating lead:', error)
      toast.error('Failed to create lead. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    setCompanyId('')
    setContacts([{ id: generateContactId(), name: '', phone: '', email: '', designation: '', isPrimary: true }])
    setCustomFieldValues({})
    setContactError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <CompanyPicker
                value={companyId}
                name={watch('companyName')}
                onChange={(id, cname) => {
                  setCompanyId(id)
                  setValue('companyName', cname, { shouldValidate: true })
                }}
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
              {errors.solution && (
                <p className="text-xs text-red-500">{errors.solution.message}</p>
              )}
            </div>
          </div>

          {/* Contacts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Contacts *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addContact}
                disabled={isLoading}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add Contact
              </Button>
            </div>

            {contactError && (
              <p className="text-xs text-red-500">{contactError}</p>
            )}

            <div className="space-y-3">
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={contact.name}
                          onChange={(e) => updateContact(contact.id, 'name', e.target.value)}
                          placeholder="Contact name"
                          disabled={isLoading}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          value={contact.phone}
                          onChange={(e) => updateContact(contact.id, 'phone', e.target.value)}
                          placeholder="Phone number"
                          disabled={isLoading}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          value={contact.email || ''}
                          onChange={(e) => updateContact(contact.id, 'email', e.target.value)}
                          placeholder="Email"
                          disabled={isLoading}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Designation</Label>
                        <Input
                          value={contact.designation || ''}
                          onChange={(e) => updateContact(contact.id, 'designation', e.target.value)}
                          placeholder="Title/Role"
                          disabled={isLoading}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      {!contact.isPrimary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateContact(contact.id, 'isPrimary', true)}
                          disabled={isLoading}
                          className="text-xs"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Set Primary
                        </Button>
                      )}
                      {contacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContact(contact.id)}
                          disabled={isLoading}
                          className="text-destructive text-xs"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
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
              <Label htmlFor="estimatedRevenue">Estimated Revenue (LKR)</Label>
              <Input
                id="estimatedRevenue"
                type="number"
                {...register('estimatedRevenue')}
                disabled={isLoading}
                placeholder="0"
              />
            </div>

            {visibleFields['probability'] !== false && (
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
            )}

            {visibleFields['imageCount'] !== false && (
              <div className="space-y-2">
                <Label htmlFor="imageCount">Image Count</Label>
                <Input
                  id="imageCount"
                  type="number"
                  {...register('imageCount')}
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
            )}

            {visibleFields['boxCount'] !== false && (
              <div className="space-y-2">
                <Label htmlFor="boxCount">Box Count</Label>
                <Input
                  id="boxCount"
                  type="number"
                  {...register('boxCount')}
                  disabled={isLoading}
                  placeholder="0"
                />
              </div>
            )}

            {visibleFields['remarks'] !== false && (
              <div className="space-y-2 col-span-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  {...register('remarks')}
                  disabled={isLoading}
                  rows={3}
                  maxLength={5000}
                  placeholder="Enter any additional notes..."
                />
              </div>
            )}

            {visibleFields['hoUpdate'] !== false && (
              <div className="space-y-2 col-span-2">
                <Label htmlFor="hoUpdate">H/O Update</Label>
                <Input
                  id="hoUpdate"
                  {...register('hoUpdate')}
                  disabled={isLoading}
                  maxLength={5000}
                  placeholder="Head Office update status"
                />
              </div>
            )}
          </div>

          {/* Custom fields configured in Workspace Settings → Lead Fields */}
          {customFields.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Custom Fields</Label>
              <div className="grid grid-cols-2 gap-4">
                {customFields.map((cf: CustomFieldConfig) => (
                  <div key={cf.id} className={cn('space-y-2', cf.type === 'text' && 'col-span-2')}>
                    <Label htmlFor={`cf_${cf.id}`}>
                      {cf.name}
                      {cf.required && <span className="text-destructive ml-1">*</span>}
                    </Label>

                    {cf.type === 'text' && (
                      <Input
                        id={`cf_${cf.id}`}
                        value={customFieldValues[cf.id] ?? ''}
                        onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: e.target.value }))}
                        disabled={isLoading}
                      />
                    )}

                    {cf.type === 'number' && (
                      <Input
                        id={`cf_${cf.id}`}
                        type="number"
                        value={customFieldValues[cf.id] ?? ''}
                        onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: e.target.value }))}
                        disabled={isLoading}
                      />
                    )}

                    {cf.type === 'date' && (
                      <Input
                        id={`cf_${cf.id}`}
                        type="date"
                        value={customFieldValues[cf.id] ?? ''}
                        onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: e.target.value }))}
                        disabled={isLoading}
                      />
                    )}

                    {cf.type === 'select' && (
                      <Select
                        value={customFieldValues[cf.id] ?? ''}
                        onValueChange={val => setCustomFieldValues(p => ({ ...p, [cf.id]: val }))}
                        disabled={isLoading}
                      >
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {cf.options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {cf.type === 'checkbox' && (
                      <div className="flex items-center gap-2 h-10">
                        <input
                          id={`cf_${cf.id}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-primary"
                          checked={customFieldValues[cf.id] === 'true'}
                          onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: String(e.target.checked) }))}
                          disabled={isLoading}
                        />
                        <label htmlFor={`cf_${cf.id}`} className="text-sm text-muted-foreground">
                          {cf.name}
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-2">Create Lead</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
