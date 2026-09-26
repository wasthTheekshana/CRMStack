import { useMemo } from 'react'
import { Lead, KPIData, StageData, SolutionData, User } from '@/types'
import { useSalesStages, useWonStages } from '@/store/tenantStore'
import { getLeadCreatedAt } from '@/lib/utils/leadAge'
import { periodStartDate, isOnOrAfter, type RelativePeriod } from '@/lib/utils/dateRange'
import type { CustomFieldConfig } from '@/services/tenantService'

export function useKPIs(leads: Lead[]): KPIData {
  const wonStages = useWonStages()
  return useMemo(() => {
    if (!leads || leads.length === 0) {
      return {
        totalCompanies: 0,
        totalLeads: 0,
        activeDeals: 0,
        totalRevenue: 0,
        weightedRevenue: 0,
        closedWonRevenue: 0,
        avgProbability: 0,
      }
    }

    // Total unique companies
    const uniqueCompanies = new Set(leads.map((l) => l.companyName.toLowerCase().trim()))
    const totalCompanies = uniqueCompanies.size

    // Total leads
    const totalLeads = leads.length

    // Active deals (not in a Won stage)
    const activeDeals = leads.filter(
      (l) => !wonStages.includes(l.salesStage)
    ).length

    // Total estimated revenue
    const totalRevenue = leads.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)

    // Weighted revenue
    const weightedRevenue = leads.reduce(
      (sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100,
      0
    )

    // Won stage revenue
    const closedWonRevenue = leads
      .filter((l) => wonStages.includes(l.salesStage))
      .reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)

    // Average probability
    const avgProbability =
      leads.length > 0
        ? leads.reduce((sum, l) => sum + (l.probability || 0), 0) / leads.length
        : 0

    return {
      totalCompanies,
      totalLeads,
      activeDeals,
      totalRevenue,
      weightedRevenue,
      closedWonRevenue,
      avgProbability,
    }
  }, [leads, wonStages])
}

export function useStageData(leads: Lead[]): StageData[] {
  const salesStages = useSalesStages()
  return useMemo(() => {
    return salesStages.map((stage) => {
      const stageLeads = leads.filter((l) => l.salesStage === stage.name)
      return {
        stage: stage.name,
        count: stageLeads.length,
        revenue: stageLeads.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0),
        weightedRevenue: stageLeads.reduce(
          (sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100,
          0
        ),
      }
    })
  }, [leads, salesStages])
}

export function useSolutionData(leads: Lead[]): SolutionData[] {
  return useMemo(() => {
    const solutionMap = new Map<string, { count: number; revenue: number }>()

    leads.forEach((lead) => {
      const solution = lead.solution || 'Other'
      const existing = solutionMap.get(solution) || { count: 0, revenue: 0 }
      solutionMap.set(solution, {
        count: existing.count + 1,
        revenue: existing.revenue + (lead.estimatedRevenue || 0),
      })
    })

    return Array.from(solutionMap.entries())
      .map(([solution, data]) => ({
        solution,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [leads])
}

export type TeamMemberStagePeriod = RelativePeriod

export interface TeamMemberStageTotal {
  ownerId: string
  ownerName: string
  totalPrice: number
  leadCount: number
}

export function useTeamMemberStageKpi(
  leads: Lead[],
  salesUsers: User[],
  stage: string,
  period: TeamMemberStagePeriod,
  cfConfigs: CustomFieldConfig[]
): TeamMemberStageTotal[] {
  return useMemo(() => {
    if (!stage) return []

    const start = periodStartDate(period)
    const totals = new Map<string, { totalPrice: number; leadCount: number }>()

    leads.forEach((lead) => {
      if (lead.salesStage !== stage) return
      // Use the tenant's configured "created date" field when set (same source
      // LeadAgeBadge/the Lead Age filter use), not always the raw DB createdAt —
      // and skip missing/unparseable dates instead of letting Invalid Date
      // comparisons (always false) count them into every period by default.
      if (!isOnOrAfter(getLeadCreatedAt(lead, cfConfigs), start)) return

      const existing = totals.get(lead.ownerId) || { totalPrice: 0, leadCount: 0 }
      totals.set(lead.ownerId, {
        totalPrice: existing.totalPrice + (lead.estimatedRevenue || 0),
        leadCount: existing.leadCount + 1,
      })
    })

    return Array.from(totals.entries())
      .map(([ownerId, data]) => ({
        ownerId,
        ownerName: salesUsers.find((u) => u.uid === ownerId)?.displayName || 'Unknown',
        totalPrice: data.totalPrice,
        leadCount: data.leadCount,
      }))
      .sort((a, b) => b.totalPrice - a.totalPrice)
  }, [leads, salesUsers, stage, period, cfConfigs])
}

export function useTopCustomers(leads: Lead[], limit = 5) {
  return useMemo(() => {
    const companyMap = new Map<string, number>()

    leads.forEach((lead) => {
      const company = lead.companyName
      const existing = companyMap.get(company) || 0
      companyMap.set(company, existing + (lead.estimatedRevenue || 0))
    })

    return Array.from(companyMap.entries())
      .map(([company, revenue]) => ({ company, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
  }, [leads, limit])
}
