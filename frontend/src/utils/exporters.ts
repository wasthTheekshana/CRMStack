import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Lead, SalesStage } from '@/models'
import { formatCurrency, timestampToDate } from './formatters'
import { format } from 'date-fns'

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [59, 130, 246]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

// Export leads to CSV
export function exportToCSV(leads: Lead[], filename: string = 'leads-export'): void {
  const data = leads.map((lead) => {
    const primaryContact = lead.contacts?.find(c => c.isPrimary) || lead.contacts?.[0]
    const contactName = primaryContact?.name || lead.contactName || ''
    const contactNumber = primaryContact?.phone || lead.contactNumber || ''

    return {
      'Company Name': lead.companyName,
      Solution: lead.solution,
      'Contact Name': contactName,
      'Contact Number': contactNumber,
      'Sales Stage': lead.salesStage,
      'Image Count': lead.imageCount,
      'Box Count': lead.boxCount,
      'Estimated Revenue': lead.estimatedRevenue,
      'Probability (%)': lead.probability,
      'Weighted Revenue': (lead.estimatedRevenue * lead.probability) / 100,
      Remarks: lead.remarks,
      'H/O Update': lead.hoUpdate,
      Owner: lead.ownerEmail,
      'Created Date': format(timestampToDate(lead.createdAt), 'yyyy-MM-dd'),
      'Updated Date': format(timestampToDate(lead.updatedAt), 'yyyy-MM-dd'),
    }
  })

  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export leads to PDF
export function exportToPDF(
  leads: Lead[],
  title: string = 'Sales Report',
  filters?: {
    dateRange?: string
    stage?: SalesStage
    solution?: string
  },
  branding?: { companyName?: string | null; primaryColor?: string | null }
): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(20)
  doc.setTextColor(33, 37, 41)
  doc.text(branding?.companyName ?? 'CRM STACK', 14, 20)

  doc.setFontSize(14)
  doc.text(title, 14, 30)

  doc.setFontSize(10)
  doc.setTextColor(108, 117, 125)
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 14, 38)

  let yPos = 42
  if (filters) {
    if (filters.dateRange) { doc.text(`Date Range: ${filters.dateRange}`, 14, yPos); yPos += 5 }
    if (filters.stage)     { doc.text(`Stage: ${filters.stage}`, 14, yPos); yPos += 5 }
    if (filters.solution)  { doc.text(`Solution: ${filters.solution}`, 14, yPos); yPos += 5 }
  }

  const totalRevenue    = leads.reduce((sum, l) => sum + l.estimatedRevenue, 0)
  const weightedRevenue = leads.reduce((sum, l) => sum + (l.estimatedRevenue * l.probability) / 100, 0)
  const avgProbability  = leads.length > 0 ? leads.reduce((sum, l) => sum + l.probability, 0) / leads.length : 0

  yPos += 5
  doc.setFontSize(11)
  doc.setTextColor(33, 37, 41)
  doc.text('Summary', 14, yPos)
  yPos += 6
  doc.setFontSize(9)
  doc.text(`Total Leads: ${leads.length}`, 14, yPos)
  doc.text(`Total Revenue: ${formatCurrency(totalRevenue)}`, 70, yPos)
  yPos += 5
  doc.text(`Weighted Revenue: ${formatCurrency(weightedRevenue)}`, 14, yPos)
  doc.text(`Avg Probability: ${avgProbability.toFixed(0)}%`, 70, yPos)

  const tableData = leads.map((lead) => {
    const primaryContact = lead.contacts?.find(c => c.isPrimary) || lead.contacts?.[0]
    const contactName = primaryContact?.name || lead.contactName || ''
    return [
      lead.companyName, lead.solution, contactName, lead.salesStage,
      formatCurrency(lead.estimatedRevenue), `${lead.probability}%`,
      formatCurrency((lead.estimatedRevenue * lead.probability) / 100),
    ]
  })

  autoTable(doc, {
    startY: yPos + 10,
    head: [['Company', 'Solution', 'Contact', 'Stage', 'Revenue', 'Prob', 'Weighted']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(branding?.primaryColor ?? '#3b82f6'), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 35 }, 1: { cellWidth: 30 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 },
      4: { cellWidth: 25, halign: 'right' }, 5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 25, halign: 'right' },
    },
    margin: { top: 10, left: 14, right: 14 },
    didDrawPage: (data) => {
      doc.setFontSize(8)
      doc.setTextColor(108, 117, 125)
      doc.text(`Page ${data.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })
    },
  })

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}

// Export summary report to PDF
export function exportSummaryToPDF(
  data: {
    totalCompanies: number
    totalLeads: number
    totalRevenue: number
    weightedRevenue: number
    stageBreakdown: { stage: string; count: number; revenue: number }[]
    solutionBreakdown: { solution: string; count: number; revenue: number }[]
  },
  title: string = 'Sales Summary Report',
  branding?: { companyName?: string | null; primaryColor?: string | null }
): void {
  const doc = new jsPDF()

  doc.setFontSize(20)
  doc.text(branding?.companyName ?? 'CRM STACK', 14, 20)
  doc.setFontSize(14)
  doc.text(title, 14, 30)
  doc.setFontSize(10)
  doc.setTextColor(108, 117, 125)
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`, 14, 38)

  doc.setFontSize(12)
  doc.setTextColor(33, 37, 41)
  doc.text('Key Metrics', 14, 50)
  doc.setFontSize(10)
  doc.text(`Total Companies: ${data.totalCompanies}`, 14, 58)
  doc.text(`Total Leads: ${data.totalLeads}`, 80, 58)
  doc.text(`Total Revenue: ${formatCurrency(data.totalRevenue)}`, 14, 66)
  doc.text(`Weighted Revenue: ${formatCurrency(data.weightedRevenue)}`, 80, 66)

  doc.setFontSize(12)
  doc.text('Pipeline by Stage', 14, 80)
  autoTable(doc, {
    startY: 85,
    head: [['Stage', 'Count', 'Revenue']],
    body: data.stageBreakdown.map((s) => [s.stage, s.count.toString(), formatCurrency(s.revenue)]),
    theme: 'striped',
    headStyles: { fillColor: hexToRgb(branding?.primaryColor ?? '#3b82f6') },
    margin: { left: 14 },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFontSize(12)
  doc.text('Revenue by Solution', 14, finalY + 15)
  autoTable(doc, {
    startY: finalY + 20,
    head: [['Solution', 'Count', 'Revenue']],
    body: data.solutionBreakdown.map((s) => [s.solution, s.count.toString(), formatCurrency(s.revenue)]),
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    margin: { left: 14 },
  })

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
