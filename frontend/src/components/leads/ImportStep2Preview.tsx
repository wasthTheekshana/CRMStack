import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { previewImport, confirmImport } from '@/lib/api/importApi'
import { applyMapping } from '@/lib/importParser'
import type { ColumnMapping, ParsedSpreadsheet } from '@/lib/importParser'
import type { PreviewResponse, PreviewRow, ConfirmRowInput, ImportResult } from '@/lib/api/importApi'

interface Props {
  parsed:            ParsedSpreadsheet;
  mapping:           ColumnMapping;
  previewResult:     PreviewResponse | null;
  onPreviewLoaded:   (r: PreviewResponse) => void;
  onBack:            () => void;
  onDone:            (result: ImportResult) => void;
}

type DuplicateAction = 'skip' | 'overwrite';

export function ImportStep2Preview({
  parsed, mapping, previewResult, onPreviewLoaded, onBack, onDone,
}: Props) {
  const [loading,     setLoading]     = useState(!previewResult)
  const [error,       setError]       = useState<string | null>(null)
  const [confirming,  setConfirming]  = useState(false)
  const [decisions,   setDecisions]   = useState<Record<number, DuplicateAction>>({})

  const loadPreview = () => {
    const rows = applyMapping(parsed.rows, mapping)
    setLoading(true)
    setError(null)
    previewImport(rows)
      .then((r) => { onPreviewLoaded(r); setLoading(false) })
      .catch(() => { setError('Failed to load preview. Check your connection and try again.'); setLoading(false) })
  }

  useEffect(() => {
    if (previewResult) return
    loadPreview()
  }, [parsed, mapping])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking for duplicates…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={loadPreview}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!previewResult) return null

  const duplicateRows   = previewResult.rows.filter(r => r.status === 'duplicate')
  const unresolvedCount = duplicateRows.filter(r => !decisions[r.index]).length
  const totalWarnings   = previewResult.rows.reduce((n, r) => n + r.warnings.length, 0)

  const handleConfirm = async () => {
    setConfirming(true)
    const confirmRows: ConfirmRowInput[] = previewResult.rows.map(row => {
      if (row.status === 'new') {
        return { index: row.index, action: 'create', data: row.parsed }
      }
      const decision = decisions[row.index]
      if (decision === 'overwrite') {
        return { index: row.index, action: 'update', existingId: row.existingLead!.id, data: row.parsed }
      }
      return { index: row.index, action: 'skip', data: row.parsed }
    })
    try {
      const result = await confirmImport(confirmRows)
      onDone(result)
    } catch {
      setError('Import failed. Please try again.')
      setConfirming(false)
    }
  }

  const importCount = previewResult.rows.filter((r) => {
    if (r.status === 'new') return true
    return decisions[r.index] === 'overwrite'
  }).length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-green-600 font-medium">{previewResult.totalNew} new</span>
        {previewResult.totalDuplicates > 0 && (
          <span className="text-yellow-600 font-medium">{previewResult.totalDuplicates} duplicates</span>
        )}
        {totalWarnings > 0 && (
          <span className="text-orange-500 font-medium">{totalWarnings} warnings</span>
        )}
      </div>

      {/* Row table */}
      <div className="border rounded-lg overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Company</th>
              <th className="text-left px-3 py-2 font-medium">Stage</th>
              <th className="text-left px-3 py-2 font-medium">Revenue</th>
              <th className="text-left px-3 py-2 font-medium">Owner</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {previewResult.rows.map((row) => (
              <RowEntry
                key={row.index}
                row={row}
                decision={decisions[row.index]}
                onDecision={(d) => setDecisions(prev => ({ ...prev, [row.index]: d }))}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={confirming}>← Back</Button>
        <Button
          disabled={unresolvedCount > 0 || confirming}
          onClick={handleConfirm}
        >
          {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {unresolvedCount > 0
            ? `Resolve ${unresolvedCount} duplicate${unresolvedCount > 1 ? 's' : ''} first`
            : `Import ${importCount} Lead${importCount !== 1 ? 's' : ''}`
          }
        </Button>
      </div>
    </div>
  )
}

function RowEntry({
  row,
  decision,
  onDecision,
}: {
  row: PreviewRow;
  decision: DuplicateAction | undefined;
  onDecision: (d: DuplicateAction) => void;
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className={`border-t ${row.status === 'duplicate' ? 'bg-yellow-50/50' : ''} ${row.warnings.length > 0 ? 'bg-orange-50/30' : ''}`}
      >
        <td className="px-3 py-2 text-muted-foreground">{row.index + 1}</td>
        <td className="px-3 py-2 font-medium">{row.parsed.companyName}</td>
        <td className="px-3 py-2 text-xs">{row.parsed.salesStage}</td>
        <td className="px-3 py-2 text-xs">{row.parsed.estimatedRevenue > 0 ? row.parsed.estimatedRevenue.toLocaleString() : '—'}</td>
        <td className="px-3 py-2 text-xs">{row.parsed.ownerEmail}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {row.status === 'new' && <Badge className="bg-green-100 text-green-700 border-0 text-xs">New</Badge>}
            {row.status === 'duplicate' && (
              <button
                className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full hover:bg-yellow-200"
                onClick={() => setExpanded(e => !e)}
              >
                {decision === 'overwrite' ? '🔄 Overwrite' : decision === 'skip' ? '⏭ Skip' : '⚠ Duplicate'}
              </button>
            )}
            {row.warnings.length > 0 && (
              <span className="text-xs text-orange-600" title={row.warnings.join('\n')}>⚠ {row.warnings.length}</span>
            )}
          </div>
        </td>
      </tr>
      {expanded && row.existingLead && (
        <tr className="bg-yellow-50/80 border-t border-yellow-100">
          <td colSpan={6} className="px-4 py-3">
            <div className="text-xs space-y-2">
              <p className="font-medium text-yellow-800">Existing lead: {row.existingLead.companyName} · {row.existingLead.salesStage} · {row.existingLead.ownerEmail}</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`dup-${row.index}`}
                    checked={decision === 'skip'}
                    onChange={() => onDecision('skip')}
                  />
                  <span>Skip — keep existing lead</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`dup-${row.index}`}
                    checked={decision === 'overwrite'}
                    onChange={() => onDecision('overwrite')}
                  />
                  <span>Overwrite — update with spreadsheet values</span>
                </label>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
