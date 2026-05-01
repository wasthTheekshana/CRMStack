// Fetches all expiry records for the current tenant once on mount.
// Provides: expiryMap (leadId → { expiryDate, daysUntil }), isLoading, error, refetch()
// Used by: LeadsPage, KanbanBoard

import { useState, useEffect, useRef, useCallback } from 'react'
import { getBulkLeadExpiry, ExpiryMap } from '@/services/leadExpiryService'

export function useLeadExpiry() {
  const [expiryMap, setExpiryMap] = useState<ExpiryMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMountedRef = useRef(false)

  const fetchExpiry = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getBulkLeadExpiry()
      if (isMountedRef.current) setExpiryMap(data ?? {})
    } catch (err) {
      if (isMountedRef.current) {
        setExpiryMap({})
        setError(err instanceof Error ? err : new Error('Failed to load expiry data'))
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchExpiry()
    return () => { isMountedRef.current = false }
  }, [fetchExpiry])

  return { expiryMap, isLoading, error, refetch: fetchExpiry }
}
