// Fetches all expiry records for the current tenant once on mount.
// Provides: expiryMap (leadId → { expiryDate, daysUntil }), isLoading, refetch()
// Used by: LeadsPage, KanbanBoard

import { useState, useEffect, useCallback } from 'react'
import { getBulkLeadExpiry, ExpiryMap } from '@/services/leadExpiryService'

export function useLeadExpiry() {
  const [expiryMap, setExpiryMap] = useState<ExpiryMap>({})
  const [isLoading, setIsLoading] = useState(true)

  const fetchExpiry = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getBulkLeadExpiry()
      setExpiryMap(data ?? {})
    } catch {
      setExpiryMap({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchExpiry() }, [fetchExpiry])

  return { expiryMap, isLoading, refetch: fetchExpiry }
}
