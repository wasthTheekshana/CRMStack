import { CheckCircle, RefreshCw, SkipForward, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import type { ImportResult } from '@/lib/api/importApi'

interface Props {
  result: ImportResult;
  onDone: () => void;
}

export function ImportStep3Result({ result, onDone }: Props) {
  const [showErrors, setShowErrors] = useState(false)
  const hasErrors = result.errors.length > 0

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
        <h3 className="text-lg font-semibold">Import Complete</h3>
      </div>

      <div className="flex justify-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-green-600">{result.created}</span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5" />
            Created
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-blue-600">{result.updated}</span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Updated
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-muted-foreground">{result.skipped}</span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <SkipForward className="h-3.5 w-3.5" />
            Skipped
          </div>
        </div>
        {hasErrors && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-destructive">{result.errors.length}</span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Errors
            </div>
          </div>
        )}
      </div>

      {hasErrors && (
        <div className="border border-destructive/30 rounded-md overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-2 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10"
            onClick={() => setShowErrors(e => !e)}
          >
            <span>{result.errors.length} row{result.errors.length > 1 ? 's' : ''} had errors</span>
            {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showErrors && (
            <ul className="divide-y text-xs">
              {result.errors.map((e) => (
                <li key={e.row} className="px-4 py-2">
                  <span className="text-muted-foreground">Row {e.row + 1}:</span> {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}
