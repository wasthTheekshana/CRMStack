import { useState, useEffect, useCallback, useRef } from 'react'
import { Lead, LeadFormData, SalesStage } from '@/types'
import { useAuthStore } from '@/store/authStore'
import {
  getLeads,
  createLead as createLeadFn,
  updateLead as updateLeadFn,
  deleteLead as deleteLeadFn,
  reassignLead as reassignLeadFn,
} from '@/lib/api/collections'

const POLL_INTERVAL_MS = 30_000 // poll every 30 seconds

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user, userProfile } = useAuthStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLeads = useCallback(async () => {
    if (!user) {
      setLeads([])
      setIsLoading(false)
      return
    }
    try {
      const data = await getLeads()
      setLeads(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setLeads([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchLeads()

    // Poll for updates every 30s (replaces Firestore onSnapshot)
    intervalRef.current = setInterval(fetchLeads, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user, fetchLeads])

  const createLead = useCallback(
    async (data: LeadFormData) => {
      if (!user || !userProfile) throw new Error('Not authenticated')
      const lead = await createLeadFn({
        ...data,
        ownerId: user.id,
        ownerEmail: userProfile.email,
        isDeleted: false,
      } as Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>)
      setLeads(prev => [lead, ...prev])
      return lead
    },
    [user, userProfile]
  )

  const updateLead = useCallback(async (id: string, data: Partial<Lead>) => {
    const updated = await updateLeadFn(id, data)
    setLeads(prev => prev.map(l => l.id === id ? updated : l))
    return updated
  }, [])

  const reassignLead = useCallback(async (leadId: string, ownerId: string) => {
    try {
      const updated = await reassignLeadFn(leadId, ownerId)
      setLeads(prev => prev.map(l => l.id === leadId ? updated : l))
      return updated
    } catch (err) {
      setError((err as Error).message)
      throw err
    }
  }, [])

  const deleteLead = useCallback(async (id: string) => {
    await deleteLeadFn(id)
    setLeads(prev => prev.filter(l => l.id !== id))
  }, [])

  const updateLeadStage = useCallback(
    async (id: string, newStage: SalesStage, probability?: number) => {
      const updated = await updateLeadFn(id, { salesStage: newStage, ...(probability !== undefined && { probability }) })
      setLeads(prev => prev.map(l => l.id === id ? updated : l))
      return updated
    },
    []
  )

  const updateLeadPosition = useCallback(async (id: string, position: number) => {
    const updated = await updateLeadFn(id, { position })
    setLeads(prev => prev.map(l => l.id === id ? updated : l))
    return updated
  }, [])

  const leadsByStage = leads.reduce(
    (acc, lead) => {
      const stage = lead.salesStage
      if (!acc[stage]) acc[stage] = []
      acc[stage].push(lead)
      return acc
    },
    {} as Record<SalesStage, Lead[]>
  )

  return {
    leads,
    leadsByStage,
    isLoading,
    error,
    createLead,
    updateLead,
    deleteLead,
    updateLeadStage,
    updateLeadPosition,
    reassignLead,
    refetch: fetchLeads,
  }
}

// Hook for leads by a specific owner (admin use)
export function useLeadsByOwner(ownerId: string | undefined) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) {
      setLeads([])
      setIsLoading(false)
      return
    }

    getLeads()
      .then(all => {
        setLeads(all.filter(l => l.ownerId === ownerId))
      })
      .finally(() => setIsLoading(false))
  }, [ownerId])

  return { leads, isLoading }
}
