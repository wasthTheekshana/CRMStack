import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImportStep1Upload } from './ImportStep1Upload'
import { ImportStep2Preview } from './ImportStep2Preview'
import { ImportStep3Result } from './ImportStep3Result'
import type { ColumnMapping, ParsedSpreadsheet } from '@/lib/importParser'
import type { PreviewResponse, ImportResult } from '@/lib/api/importApi'

interface Props {
  open:       boolean;
  onClose:    () => void;
  onComplete: () => void;
}

const STEP_LABELS = ['Upload & Map', 'Review', 'Done'];

export function ImportLeadsModal({ open, onClose, onComplete }: Props) {
  const [step,          setStep]          = useState<1 | 2 | 3>(1)
  const [parsed,        setParsed]        = useState<ParsedSpreadsheet | null>(null)
  const [mapping,       setMapping]       = useState<ColumnMapping>({})
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null)
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null)

  const handleClose = () => {
    setStep(1)
    setParsed(null)
    setMapping({})
    setPreviewResult(null)
    setImportResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const active    = step === n
            const completed = step > n
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${
                  active    ? 'bg-primary text-primary-foreground' :
                  completed ? 'bg-primary/20 text-primary' :
                              'bg-muted text-muted-foreground'
                }`}>
                  <span>{n}</span>
                  <span>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-6 ${step > n ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {step === 1 && (
          <ImportStep1Upload
            onNext={(p: ParsedSpreadsheet, m: ColumnMapping) => {
              setParsed(p)
              setMapping(m)
              setStep(2)
            }}
          />
        )}

        {step === 2 && parsed && (
          <ImportStep2Preview
            parsed={parsed}
            mapping={mapping}
            onBack={() => setStep(1)}
            onDone={(result: ImportResult) => {
              setImportResult(result)
              setStep(3)
            }}
            onPreviewLoaded={setPreviewResult}
            previewResult={previewResult}
          />
        )}

        {step === 3 && importResult && (
          <ImportStep3Result
            result={importResult}
            onDone={() => {
              onComplete()
              handleClose()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
