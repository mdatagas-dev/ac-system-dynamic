-- Add typed category-specific storage. This migration is additive: legacy JSONB and
-- recordscan remain available for rollback until the explicit cleanup migration.

DO $$
BEGIN
  -- `wm` is the canonical washing-machine slug. Rename only when it cannot clash.
  IF EXISTS (SELECT 1 FROM product_categories WHERE slug = 'washing')
     AND NOT EXISTS (SELECT 1 FROM product_categories WHERE slug = 'wm') THEN
    UPDATE product_categories SET slug = 'wm' WHERE slug = 'washing';
    UPDATE bomlist SET product_category = 'wm' WHERE product_category = 'washing';
    UPDATE registscan SET product_category = 'wm' WHERE product_category = 'washing';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ac_bom_spec (
  bom_id uuid PRIMARY KEY REFERENCES bomlist(id) ON DELETE CASCADE,
  sn_prefix varchar(255), sn_required boolean NOT NULL DEFAULT true, sn_unit varchar(3),
  sn_odu_prefix varchar(255), sn_odu_required boolean NOT NULL DEFAULT false, sn_odu_unit varchar(3),
  sn_carton_prefix varchar(255), sn_carton_required boolean NOT NULL DEFAULT false, sn_carton_unit varchar(3),
  pcb_idu_prefix varchar(255), pcb_idu_required boolean NOT NULL DEFAULT false, pcb_idu_unit varchar(3),
  sn_box_prefix varchar(255), sn_box_required boolean NOT NULL DEFAULT false, sn_box_unit varchar(3),
  sn_motor_prefix varchar(255), sn_motor_required boolean NOT NULL DEFAULT false, sn_motor_unit varchar(3),
  sn_accessories_prefix varchar(255), sn_accessories_required boolean NOT NULL DEFAULT false, sn_accessories_unit varchar(3)
);

CREATE TABLE IF NOT EXISTS wm_bom_spec (
  bom_id uuid PRIMARY KEY REFERENCES bomlist(id) ON DELETE CASCADE,
  sn_prefix varchar(255), sn_required boolean NOT NULL DEFAULT true,
  sn_drum_prefix varchar(255), sn_drum_required boolean NOT NULL DEFAULT true,
  sn_pump_prefix varchar(255), sn_pump_required boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS ac_registration_spec (
  id_regist uuid PRIMARY KEY REFERENCES registscan(id) ON DELETE CASCADE,
  sn varchar(255), sn_odu varchar(255), sn_carton varchar(255), pcb_idu varchar(255),
  sn_box varchar(255), sn_motor varchar(255), sn_accessories varchar(255)
);

CREATE TABLE IF NOT EXISTS wm_registration_spec (
  id_regist uuid PRIMARY KEY REFERENCES registscan(id) ON DELETE CASCADE,
  sn varchar(255), sn_drum varchar(255), sn_pump varchar(255)
);

CREATE TABLE IF NOT EXISTS recordscan_ac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_regist uuid NOT NULL REFERENCES registscan(id) ON DELETE CASCADE,
  sn varchar(255), sn_odu varchar(255), sn_carton varchar(255), pcb_idu varchar(255),
  sn_box varchar(255), sn_motor varchar(255), sn_accessories varchar(255),
  timestamps timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recordscan_wm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_regist uuid NOT NULL REFERENCES registscan(id) ON DELETE CASCADE,
  sn varchar(255), sn_drum varchar(255), sn_pump varchar(255),
  timestamps timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_component_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table varchar(64) NOT NULL,
  source_id varchar(255) NOT NULL,
  category varchar(50),
  components jsonb NOT NULL,
  reason varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recordscan_ac_id_regist_idx ON recordscan_ac(id_regist);
CREATE INDEX IF NOT EXISTS recordscan_ac_sn_idx ON recordscan_ac(sn);
CREATE INDEX IF NOT EXISTS recordscan_ac_sn_odu_idx ON recordscan_ac(sn_odu);
CREATE INDEX IF NOT EXISTS recordscan_ac_sn_carton_idx ON recordscan_ac(sn_carton);
CREATE INDEX IF NOT EXISTS recordscan_ac_pcb_idu_idx ON recordscan_ac(pcb_idu);
CREATE INDEX IF NOT EXISTS recordscan_ac_sn_box_idx ON recordscan_ac(sn_box);
CREATE INDEX IF NOT EXISTS recordscan_ac_sn_motor_idx ON recordscan_ac(sn_motor);
CREATE INDEX IF NOT EXISTS recordscan_ac_sn_accessories_idx ON recordscan_ac(sn_accessories);
CREATE INDEX IF NOT EXISTS recordscan_ac_timestamps_idx ON recordscan_ac(timestamps);
CREATE INDEX IF NOT EXISTS recordscan_wm_id_regist_idx ON recordscan_wm(id_regist);
CREATE INDEX IF NOT EXISTS recordscan_wm_sn_idx ON recordscan_wm(sn);
CREATE INDEX IF NOT EXISTS recordscan_wm_sn_drum_idx ON recordscan_wm(sn_drum);
CREATE INDEX IF NOT EXISTS recordscan_wm_sn_pump_idx ON recordscan_wm(sn_pump);
CREATE INDEX IF NOT EXISTS recordscan_wm_timestamps_idx ON recordscan_wm(timestamps);
CREATE UNIQUE INDEX IF NOT EXISTS legacy_component_quarantine_source_unique ON legacy_component_quarantine(source_table, source_id);
CREATE INDEX IF NOT EXISTS legacy_component_quarantine_source_idx ON legacy_component_quarantine(source_table, source_id);

-- Read-only compatibility view for reports that aggregate categories. New writes never
-- target this view. WM-only columns intentionally remain in recordscan_wm.
CREATE OR REPLACE VIEW recordscan_all AS
SELECT id, id_regist, sn, sn_odu, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories, timestamps, 'ac'::text AS product_category
FROM recordscan_ac
UNION ALL
SELECT id, id_regist, sn, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, timestamps, 'wm'::text AS product_category
FROM recordscan_wm;

-- AC BOM/backfill. Required/unit metadata remains on the old category template during
-- compatibility; the typed prefixes are the source for new category-aware writes.
INSERT INTO ac_bom_spec (
  bom_id, sn_prefix, sn_odu_prefix, sn_carton_prefix, pcb_idu_prefix,
  sn_box_prefix, sn_motor_prefix, sn_accessories_prefix
)
SELECT b.id, b.sn, b.components->'sn_odu'->>'prefix', b.sn_carton, b.pcb_idu,
       b.sn_box, b.sn_motor, b.sn_accessories
FROM bomlist b
WHERE b.product_category = 'ac'
ON CONFLICT (bom_id) DO NOTHING;

-- Preserve the legacy category template's required and unit metadata. A field
-- absent from the template is disabled rather than becoming newly required.
UPDATE ac_bom_spec spec
SET
  sn_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn' LIMIT 1), false),
  sn_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn' LIMIT 1),
  sn_odu_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_odu' LIMIT 1), false),
  sn_odu_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_odu' LIMIT 1),
  sn_carton_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_carton' LIMIT 1), false),
  sn_carton_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_carton' LIMIT 1),
  pcb_idu_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'pcb_idu' LIMIT 1), false),
  pcb_idu_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'pcb_idu' LIMIT 1),
  sn_box_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_box' LIMIT 1), false),
  sn_box_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_box' LIMIT 1),
  sn_motor_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_motor' LIMIT 1), false),
  sn_motor_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_motor' LIMIT 1),
  sn_accessories_required = COALESCE((SELECT COALESCE((f->>'required')::boolean, true) FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_accessories' LIMIT 1), false),
  sn_accessories_unit = (SELECT NULLIF(f->>'unit', '') FROM jsonb_array_elements(COALESCE(c.fields, '[]'::jsonb)) f WHERE f->>'key' = 'sn_accessories' LIMIT 1)
FROM bomlist b
LEFT JOIN product_categories c ON c.slug = b.product_category
WHERE spec.bom_id = b.id AND b.product_category = 'ac';

INSERT INTO wm_bom_spec (bom_id, sn_prefix, sn_drum_prefix, sn_pump_prefix, sn_drum_required, sn_pump_required)
SELECT b.id,
       b.sn,
       b.components->'sn_drum'->>'prefix',
       b.components->'sn_pump'->>'prefix',
       COALESCE((b.components->'sn_drum'->>'required')::boolean, true),
       COALESCE((b.components->'sn_pump'->>'required')::boolean, false)
FROM bomlist b
WHERE b.product_category = 'wm'
ON CONFLICT (bom_id) DO NOTHING;

INSERT INTO ac_registration_spec (id_regist, sn, sn_odu, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories)
SELECT r.id, r.sn, r.sn_odu, r.sn_carton, r.pcb_idu, r.sn_box, r.sn_motor, r.sn_accessories
FROM registscan r
WHERE r.product_category = 'ac'
ON CONFLICT (id_regist) DO NOTHING;

INSERT INTO wm_registration_spec (id_regist, sn, sn_drum, sn_pump)
SELECT r.id, r.sn, r.components->>'sn_drum', r.components->>'sn_pump'
FROM registscan r
WHERE r.product_category = 'wm'
ON CONFLICT (id_regist) DO NOTHING;

INSERT INTO recordscan_ac (id, id_regist, sn, sn_odu, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories, timestamps)
SELECT s.id, s.id_regist::uuid, s.sn, s.sn_odu, s.sn_carton, s.pcb_idu, s.sn_box, s.sn_motor, s.sn_accessories, s.timestamps
FROM recordscan s
JOIN registscan r ON r.id = s.id_regist::uuid
WHERE s.id_regist ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND r.product_category = 'ac'
ON CONFLICT (id) DO NOTHING;

INSERT INTO recordscan_wm (id, id_regist, sn, sn_drum, sn_pump, timestamps)
SELECT s.id, s.id_regist::uuid, s.sn, s.components->>'sn_drum', s.components->>'sn_pump', s.timestamps
FROM recordscan s
JOIN registscan r ON r.id = s.id_regist::uuid
WHERE s.id_regist ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND r.product_category = 'wm'
ON CONFLICT (id) DO NOTHING;

-- Preserve malformed IDs, unsupported categories, and unknown components for manual resolution.
INSERT INTO legacy_component_quarantine (source_table, source_id, category, components, reason)
SELECT 'recordscan', s.id::text, r.product_category, COALESCE(s.components, '{}'::jsonb),
       CASE WHEN s.id_regist !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN 'Malformed id_regist' ELSE 'Unsupported or missing product category' END
FROM recordscan s
LEFT JOIN registscan r ON s.id_regist ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND r.id = s.id_regist::uuid
WHERE s.id_regist !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR r.product_category NOT IN ('ac', 'wm') OR r.product_category IS NULL
ON CONFLICT DO NOTHING;

-- Preserve component objects that do not fit the provisional typed schemas for manual review.
INSERT INTO legacy_component_quarantine (source_table, source_id, category, components, reason)
SELECT 'bomlist', b.id::text, b.product_category, b.components,
       'Unsupported component keys for typed category schema'
FROM bomlist b
WHERE b.components IS NOT NULL
  AND b.components <> '{}'::jsonb
  AND ((b.product_category = 'ac' AND b.components - 'sn_odu' <> '{}'::jsonb)
       OR (b.product_category = 'wm' AND b.components - 'sn_drum' - 'sn_pump' <> '{}'::jsonb))
  AND NOT EXISTS (
    SELECT 1 FROM legacy_component_quarantine q
    WHERE q.source_table = 'bomlist' AND q.source_id = b.id::text
  );

INSERT INTO legacy_component_quarantine (source_table, source_id, category, components, reason)
SELECT 'registscan', r.id::text, r.product_category, r.components,
       'Unsupported component keys for typed category schema'
FROM registscan r
WHERE r.components IS NOT NULL
  AND r.components <> '{}'::jsonb
  AND ((r.product_category = 'ac' AND r.components - 'sn_odu' <> '{}'::jsonb)
       OR (r.product_category = 'wm' AND r.components - 'sn_drum' - 'sn_pump' <> '{}'::jsonb))
ON CONFLICT DO NOTHING;

INSERT INTO legacy_component_quarantine (source_table, source_id, category, components, reason)
SELECT 'recordscan', s.id::text, r.product_category, s.components,
       'Unsupported component keys for typed category schema'
FROM recordscan s
JOIN registscan r ON s.id_regist ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND r.id = s.id_regist::uuid
WHERE s.components IS NOT NULL
  AND s.components <> '{}'::jsonb
  AND ((r.product_category = 'ac' AND s.components - 'sn_odu' <> '{}'::jsonb)
       OR (r.product_category = 'wm' AND s.components - 'sn_drum' - 'sn_pump' <> '{}'::jsonb))
ON CONFLICT DO NOTHING;
