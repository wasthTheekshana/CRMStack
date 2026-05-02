import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { BrandingConfig } from '@/store/tenantStore'

interface BrandingSettingsProps {
  branding:  BrandingConfig
  onChange:  (b: BrandingConfig) => void
  isSaving:  boolean
  onSave:    () => void
}

export function BrandingSettings({ branding, onChange, isSaving, onSave }: BrandingSettingsProps) {
  const update = (patch: Partial<BrandingConfig>) => onChange({ ...branding, ...patch })

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Customize how your company appears in the CRM.
      </p>

      <div className="space-y-2">
        <Label>Company Name</Label>
        <Input
          value={branding.companyName ?? ''}
          onChange={e => update({ companyName: e.target.value })}
          placeholder="Acme Corp"
        />
      </div>

      <div className="space-y-2">
        <Label>Primary Color</Label>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-md border shadow"
            style={{ backgroundColor: branding.primaryColor ?? '#3B82F6' }}
          />
          <input
            type="color"
            value={branding.primaryColor ?? '#3B82F6'}
            onChange={e => update({ primaryColor: e.target.value })}
            className="h-10 w-20 cursor-pointer rounded border"
          />
          <span className="text-sm text-muted-foreground font-mono">
            {branding.primaryColor ?? '#3B82F6'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Logo URL</Label>
        <Input
          value={branding.logoUrl ?? ''}
          onChange={e => update({ logoUrl: e.target.value })}
          placeholder="https://your-company.com/logo.png"
        />
        {branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt="Logo preview"
            className="h-12 mt-2 object-contain rounded border p-1 bg-muted"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Favicon URL</Label>
        <Input
          value={branding.faviconUrl ?? ''}
          onChange={e => update({ faviconUrl: e.target.value })}
          placeholder="https://your-company.com/favicon.ico"
        />
      </div>

      {/* Preview */}
      <div
        className="rounded-lg p-4 text-white text-sm font-medium"
        style={{ backgroundColor: branding.primaryColor ?? '#3B82F6' }}
      >
        Preview — {branding.companyName || 'Your Company'} CRM
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Branding'}
      </Button>
    </div>
  )
}
