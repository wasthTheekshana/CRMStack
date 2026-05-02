// PostgreSQL returns dates as ISO strings — no Firebase Timestamp needed
export type ISODateString = string

// User types
export interface User {
  uid: string
  id?: string
  email: string
  username: string
  role: 'admin' | 'sales'
  displayName: string
  isActive: boolean
  createdAt?: ISODateString
  lastLoginAt?: ISODateString
}

export interface AuthUser {
  uid: string
  email: string | null
}

// Lead types — stage names are now tenant-defined, so SalesStage is string
export type SalesStage = string

export interface Contact {
  id: string
  name: string
  phone: string
  email?: string
  designation?: string
  isPrimary: boolean
}

export interface Lead {
  id: string
  companyName: string
  solution: string
  contacts: Contact[]
  contactName?: string
  contactNumber?: string
  salesStage: SalesStage
  imageCount: number
  boxCount: number
  estimatedRevenue: number
  probability: number
  remarks: string
  hoUpdate: string
  ownerId: string
  ownerEmail: string
  tenantId?: string
  customFields?: Record<string, unknown>
  position?: number
  isDeleted?: boolean
  deletedAt?: ISODateString
  createdAt?: ISODateString
  updatedAt?: ISODateString
}

export type LeadFormData = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'ownerId' | 'ownerEmail'>

// Task types
export type TaskType = 'call' | 'email' | 'meeting' | 'follow-up' | 'other'
export type TaskStatus = 'pending' | 'completed' | 'overdue'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  leadId: string
  title: string
  description: string
  type: TaskType
  dueDate: ISODateString
  status: TaskStatus
  priority: TaskPriority
  ownerId: string
  createdAt?: ISODateString
  completedAt?: ISODateString
}

// Activity types
export type ActivityType = 'note' | 'stage_change' | 'call' | 'email' | 'meeting'

export interface Activity {
  id: string
  leadId: string
  type: ActivityType
  description: string
  metadata?: Record<string, unknown>
  ownerId: string
  createdAt?: ISODateString
}

// KPI types
export interface KPIData {
  totalCompanies: number
  totalLeads: number
  activeDeals: number
  totalRevenue: number
  weightedRevenue: number
  closedWonRevenue: number
  avgProbability: number
  previousMonthRevenue?: number
}

// Chart data types
export interface StageData {
  stage: SalesStage
  count: number
  revenue: number
  weightedRevenue: number
}

export interface SolutionData {
  solution: string
  count: number
  revenue: number
}

export interface ProbabilityData {
  probability: number
  salesA: { count: number; revenue: number; weightedRevenue: number }
  salesB: { count: number; revenue: number; weightedRevenue: number }
}

// Report filters
export interface ReportFilters {
  dateRange?: { start: Date; end: Date }
  salesStage?: SalesStage[]
  solution?: string[]
  ownerId?: string
}

// Dashboard customization settings
export interface DashboardSettings {
  kpiCards: {
    companies: boolean
    totalLeads: boolean
    activeDeals: boolean
    totalRevenue: boolean
    weighted: boolean
  }
  sections: {
    pipelineByStage: boolean
    revenueBySolution: boolean
    opportunityHeatmap: boolean
    topCustomers: boolean
    recentActivities: boolean
    revenueByStage: boolean
    revenueForecasting: boolean
  }
  navigation?: {
    salesTargets: boolean
    quarterlyTargets: boolean
  }
}

// Revenue Forecast types
export interface RevenueForecast {
  expectedThisMonth: number
  expectedThisQuarter: number
  weightedForecast: number
  bestCase: number
  worstCase: number
  byStage: {
    stage: SalesStage
    deals: number
    revenue: number
    weightedRevenue: number
    probability: number
  }[]
}

// Sales Target types
export interface SalesTarget {
  id: string
  year: number
  month: number
  target: number
  achievement: number
  ownerId: string
  ownerEmail: string
  ownerName: string
  createdAt?: ISODateString
  updatedAt?: ISODateString
}

export type SalesTargetFormData = Omit<SalesTarget, 'id' | 'createdAt' | 'updatedAt' | 'ownerId' | 'ownerEmail' | 'ownerName'>

// Quarterly summary for admin view
export interface QuarterlySummary {
  quarter: number
  year: number
  totalTarget: number
  totalAchievement: number
  variance: number
  percentage: number
  byUser: {
    ownerId: string
    ownerName: string
    ownerEmail: string
    target: number
    achievement: number
    variance: number
    percentage: number
  }[]
}
