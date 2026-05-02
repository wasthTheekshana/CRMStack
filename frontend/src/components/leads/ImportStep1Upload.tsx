import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseSpreadsheet, autoMapColumns, CRM_FIELD_LABELS } from '@/lib/importParser'
import type { ColumnMapping, ParsedSpreadsheet, CrmField, StandardCrmField } from '@/lib/importParser'
import { useCustomFields } from '@/store/tenantStore'

const MAX_ROWS = 1000
const MAX_FILE_BYTES = 5 * 1024 * 1024

const STANDARD_FIELDS: StandardCrmField[] = [
  'companyName', 'solution', 'salesStage', 'estimatedRevenue', 'probability',
  'remarks', 'hoUpdate', 'imageCount', 'boxCount',
  'contactName', 'contactPhone', 'contactEmail', 'ownerEmail',
]

interface Props {
  onNext: (parsed: ParsedSpreadsheet, mapping: ColumnMapping) => void;
}

export function ImportStep1Upload({ onNext }: Props) {
  const [parsed,   setParsed]   = useState<ParsedSpreadsheet | null>(null)
  const [mapping,  setMapping]  = useState<ColumnMapping>({})
  const [error,    setError]    = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const customFields = useCustomFields()

  const handleFile = async (file: File) => {
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setError('Only .csv, .xlsx, and .xls files are supported.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large. Maximum size is 5 MB.')
      return
    }
    try {
      const result = await parseSpreadsheet(file)
      if (result.rows.length > MAX_ROWS) {
        setError(`File has ${result.rows.length.toLocaleString()} rows. Maximum is 1,000 rows per import.`)
        return
      }
      if (result.rows.length === 0) {
        setError('The file appears to be empty.')
        return
      }
      const auto = autoMapColumns(result.headers, customFields)
      setParsed(result)
      setMapping(auto)
    } catch {
      setError('Could not read the file. Make sure it is a valid CSV or Excel file.')
    }
  }

  const getLabelForField = (field: CrmField): string => {
    if (field.startsWith('custom:')) {
      const id = field.slice(7)
      return customFields.find(cf => cf.id === id)?.name ?? field
    }
    return CRM_FIELD_LABELS[field as StandardCrmField] ?? field
  }

  const canProceed = parsed !== null && Object.values(mapping).includes('companyName')

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls — max 1,000 rows, 5 MB</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {parsed && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span>{parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns detected</span>
          </div>

          {/* Column mapping table */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Map Columns</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Your Spreadsheet Column</th>
                    <th className="text-left px-4 py-2 font-medium">CRM Field</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((header) => (
                    <tr key={header} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{header}</td>
                      <td className="px-4 py-2">
                        <Select
                          value={mapping[header] ?? '__none__'}
                          onValueChange={(val) =>
                            setMapping(prev => ({
                              ...prev,
                              [header]: val === '__none__' ? null : val as CrmField,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs w-52">
                            <SelectValue>
                              {mapping[header]
                                ? getLabelForField(mapping[header]!)
                                : "Don't import"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Don't import</SelectItem>

                            {/* Standard CRM fields */}
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Standard Fields
                            </div>
                            {STANDARD_FIELDS.map(f => (
                              <SelectItem key={f} value={f}>
                                {CRM_FIELD_LABELS[f]}
                                {f === 'companyName' && ' *'}
                              </SelectItem>
                            ))}

                            {/* Admin-configured custom fields */}
                            {customFields.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">
                                  Custom Fields
                                </div>
                                {customFields.map(cf => (
                                  <SelectItem key={cf.id} value={`custom:${cf.id}`}>
                                    {cf.name}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">* Required field</p>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!canProceed}
          onClick={() => parsed && onNext(parsed, mapping)}
        >
          Preview Import →
        </Button>
      </div>
    </div>
  )
}
