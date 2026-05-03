import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ExpiryBadge } from './ExpiryBadge'
import {
  getLeadExpiry,
  setLeadExpiry,
  deleteLeadExpiry,
  LeadExpiry,
} from '@/services/leadExpiryService'
import { useAuthStore, useIsAdmin } from '@/store/authStore'
import { getLeadAgeDays, formatLeadAge } from '@/lib/utils/leadAge'

interface Props {
  leadId:     string
  ownerId:    string
  createdAt?: string
  onChanged?: () => void
}

export function LeadExpiryPanel({ leadId, ownerId, createdAt, onChanged }: Props) {
  const [expiry, setExpiry]       = useState<LeadExpiry | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [dateValue, setDateValue] = useState('')

  const { userProfile } = useAuthStore()
  const isAdmin = useIsAdmin()
  const canEdit = isAdmin || ownerId === userProfile?.id

  useEffect(() => {
    setExpiry(null)
    setDateValue('')
    setLoading(true)
    getLeadExpiry(leadId)
      .then(data => {
        setExpiry(data)
        if (data) setDateValue(data.expiryDate)
      })
      .catch(() => {/* silent — badge will show null */})
      .finally(() => setLoading(false))
  }, [leadId])

  const daysOpen = getLeadAgeDays(createdAt)

  let daysUntil: number | null = null
  if (expiry) {
    const [y, m, d] = expiry.expiryDate.split('-').map(Number)
    const expiryMidnight = new Date(y, m - 1, d).getTime()
    const todayMidnight  = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    daysUntil = Math.round((expiryMidnight - todayMidnight) / 86_400_000)
  }

  const handleSave = async () => {
    if (!dateValue) return
    setSaving(true)
    try {
      const updated = await setLeadExpiry(leadId, dateValue)
      setExpiry(updated)
      setDateValue(updated.expiryDate)
      onChanged?.()
    } catch {
      toast.error('Failed to set expiry date')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      await deleteLeadExpiry(leadId)
      setExpiry(null)
      setDateValue('')
      onChanged?.()
    } catch {
      toast.error('Failed to remove expiry date')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      {daysOpen >= 0 && (
        <p className="text-sm text-muted-foreground">
          Open for {formatLeadAge(createdAt)}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <ExpiryBadge daysUntil={daysUntil} />
          {canEdit && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="date"
                value={dateValue}
                onChange={e => setDateValue(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <Button size="sm" onClick={handleSave} disabled={saving || !dateValue}>
                {expiry ? 'Update Expiry' : 'Set Expiry'}
              </Button>
              {expiry && (
                <Button size="sm" variant="ghost" onClick={handleRemove} disabled={saving}>
                  Remove
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
