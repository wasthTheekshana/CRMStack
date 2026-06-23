-- Custom Fields V2: Migrate hardcoded fields to unified custom field system
-- This migration is idempotent and preserves all existing data.

-- Step 1: Add new JSONB columns to tenant_configs
ALTER TABLE tenant_configs
  ADD COLUMN IF NOT EXISTS field_groups          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_widgets     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS core_field_visibility JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Step 2: For each tenant, create field definitions for hardcoded fields
-- based on their visible_fields config, and add a default "General" group.
-- Also copy probability visibility into core_field_visibility.
DO $$
DECLARE
  tenant RECORD;
  vis    JSONB;
  existing_cf JSONB;
  new_fields  JSONB;
  merged_cf   JSONB;
  max_order   INT;
BEGIN
  FOR tenant IN SELECT tenant_id, custom_fields, visible_fields FROM tenant_configs LOOP
    vis         := COALESCE(tenant.visible_fields, '{}'::jsonb);
    existing_cf := COALESCE(tenant.custom_fields, '[]'::jsonb);

    -- Find the max order in existing custom fields
    SELECT COALESCE(MAX((elem->>'order')::int), 0)
      INTO max_order
      FROM jsonb_array_elements(existing_cf) AS elem;

    new_fields := '[]'::jsonb;

    -- image_count → std_image_count (if visible or default true)
    IF COALESCE((vis->>'imageCount')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_image_count', 'name', 'Image Count', 'type', 'number',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
      max_order := max_order + 1;
    END IF;

    -- box_count → std_box_count
    IF COALESCE((vis->>'boxCount')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_box_count', 'name', 'Box Count', 'type', 'number',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
      max_order := max_order + 1;
    END IF;

    -- remarks → std_remarks
    IF COALESCE((vis->>'remarks')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_remarks', 'name', 'Remarks', 'type', 'text',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
      max_order := max_order + 1;
    END IF;

    -- ho_update → std_ho_update
    IF COALESCE((vis->>'hoUpdate')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_ho_update', 'name', 'HO Update', 'type', 'text',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
    END IF;

    -- Merge: append new field definitions after existing custom fields
    merged_cf := existing_cf || new_fields;

    -- Add order to existing custom fields that don't have it
    -- and assign them to grp_general
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'order' IS NULL
          THEN elem || jsonb_build_object('order', row_number, 'group', 'grp_general')
        WHEN elem->>'group' IS NULL
          THEN elem || jsonb_build_object('group', 'grp_general')
        ELSE elem
      END
    ) INTO merged_cf
    FROM (
      SELECT elem, ROW_NUMBER() OVER () AS row_number
      FROM jsonb_array_elements(merged_cf) AS elem
    ) sub;

    -- Update tenant config
    UPDATE tenant_configs SET
      custom_fields         = COALESCE(merged_cf, '[]'::jsonb),
      field_groups          = jsonb_build_array(jsonb_build_object(
        'id', 'grp_general', 'name', 'General', 'order', 0, 'collapsed', false
      )),
      core_field_visibility = jsonb_build_object(
        'probability', COALESCE((vis->>'probability')::boolean, true)
      )
    WHERE tenant_id = tenant.tenant_id;
  END LOOP;
END $$;

-- Step 3: Copy lead data from columns into custom_fields JSONB
UPDATE leads SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || jsonb_build_object(
  'std_image_count', COALESCE(image_count, 0),
  'std_box_count',   COALESCE(box_count, 0),
  'std_remarks',     COALESCE(remarks, ''),
  'std_ho_update',   COALESCE(ho_update, '')
);

-- Step 4: Do NOT drop old columns — they are a rollback safety net
-- image_count, box_count, remarks, ho_update stay in the leads table
