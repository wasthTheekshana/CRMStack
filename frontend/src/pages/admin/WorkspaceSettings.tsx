import { useState, useEffect } from 'react'
import { Settings, GitBranch, Package, ListPlus, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PipelineSettings } from '@/components/settings/PipelineSettings'
import { ProductSettings } from '@/components/settings/ProductSettings'
import { LeadFieldSettings } from '@/components/settings/LeadFieldSettings'
import { BrandingSettings } from '@/components/settings/BrandingSettings'
import {
  useTenantStore,
  SalesStageConfig,
  SolutionConfig,
  CustomFieldConfig,
  BrandingConfig,
} from '@/store/tenantStore'

export function WorkspaceSettings() {
  const { config, loadConfig, saveConfig, isLoading } = useTenantStore()
  const [isSaving, setIsSaving] = useState(false)

  // Local draft state — user edits locally, saves explicitly
  const [stages,        setStages]        = useState<SalesStageConfig[]>([])
  const [solutions,     setSolutions]     = useState<SolutionConfig[]>([])
  const [customFields,  setCustomFields]  = useState<CustomFieldConfig[]>([])
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({})
  const [branding,      setBranding]      = useState<BrandingConfig>({})

  // Initialise local state from loaded config
  useEffect(() => {
    if (config) {
      setStages(config.salesStages)
      setSolutions(config.solutions)
      setCustomFields(config.customFields)
      setVisibleFields(config.visibleFields)
      setBranding(config.branding)
    }
  }, [config])

  useEffect(() => { loadConfig() }, [loadConfig])

  const save = async (patch: Parameters<typeof saveConfig>[0]) => {
    setIsSaving(true)
    try {
      await saveConfig(patch)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && !config) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading workspace settings…
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Workspace Settings</h1>
          <p className="text-sm text-muted-foreground">
            Customise your CRM pipeline, products, lead fields, and branding
          </p>
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline" className="flex items-center gap-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" /> Products
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-1.5 text-xs">
            <ListPlus className="h-3.5 w-3.5" /> Lead Fields
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5 text-xs">
            <Palette className="h-3.5 w-3.5" /> Branding
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stages</CardTitle>
              <CardDescription>Define the stages leads move through in your sales process</CardDescription>
            </CardHeader>
            <CardContent>
              <PipelineSettings
                stages={stages}
                onChange={setStages}
                isSaving={isSaving}
                onSave={() => save({ salesStages: stages })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Products &amp; Solutions</CardTitle>
              <CardDescription>Categories shown in the lead solution dropdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductSettings
                solutions={solutions}
                onChange={setSolutions}
                isSaving={isSaving}
                onSave={() => save({ solutions })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields">
          <Card>
            <CardHeader>
              <CardTitle>Lead Fields</CardTitle>
              <CardDescription>Show/hide standard fields and add custom fields to leads</CardDescription>
            </CardHeader>
            <CardContent>
              <LeadFieldSettings
                customFields={customFields}
                visibleFields={visibleFields}
                onChangeCustom={setCustomFields}
                onChangeVisible={setVisibleFields}
                isSaving={isSaving}
                onSave={() => save({ customFields, visibleFields })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Customise how your company appears in the CRM</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingSettings
                branding={branding}
                onChange={setBranding}
                isSaving={isSaving}
                onSave={() => save({ branding })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
