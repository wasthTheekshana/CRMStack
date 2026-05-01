import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { reassignLead } from '@/services/leadService'
import { getAllUsers } from '@/services/userService'
import { toast } from 'sonner'

interface TeamMember {
  id: string
  displayName: string
  email: string
  role: string
}

interface Props {
  leadId:         string
  currentOwnerId: string
  onReassigned:   (update: { id: string; ownerId: string; ownerEmail: string }) => void
}

export function ReassignOwnerSelect({ leadId, currentOwnerId, onReassigned }: Props) {
  const [members, setMembers]   = useState<TeamMember[]>([])
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    getAllUsers()
      .then((users) => {
        const active = users
          .filter((u) => u.isActive === true)
          .map((u) => ({
            id:          (u.uid || u.id) as string,
            displayName: (u.displayName || u.email) as string,
            email:       u.email as string,
            role:        u.role  as string,
          }))

        // If current owner is inactive, inject them as the first entry so the
        // Select can show a valid pre-selection rather than a blank placeholder.
        const alreadyIncluded = active.some((m) => m.id === currentOwnerId)
        if (!alreadyIncluded) {
          const currentOwner = users.find((u) => (u.uid || u.id) === currentOwnerId)
          if (currentOwner) {
            active.unshift({
              id:          (currentOwner.uid || currentOwner.id) as string,
              displayName: `${currentOwner.displayName || currentOwner.email} (inactive)`,
              email:       currentOwner.email as string,
              role:        currentOwner.role  as string,
            })
          }
        }

        setMembers(active)
      })
      .catch(() => toast.error('Failed to load team members'))
      .finally(() => setFetching(false))
  }, [currentOwnerId])

  const handleChange = async (newOwnerId: string) => {
    if (newOwnerId === currentOwnerId) return
    setLoading(true)
    try {
      const updated = await reassignLead(leadId, newOwnerId)
      onReassigned({
        id:         updated.id         as string,
        ownerId:    updated.ownerId    as string,
        ownerEmail: updated.ownerEmail as string,
      })
      toast.success('Lead reassigned')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reassign lead'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  return (
    <div className="relative">
      {loading && (
        <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground z-10" />
      )}
      <Select
        value={currentOwnerId}
        onValueChange={handleChange}
        disabled={loading}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select owner" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.displayName} ({m.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
