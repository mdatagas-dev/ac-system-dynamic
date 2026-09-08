-- Destructive cleanup after the typed AC/WM cutover.
-- Backup the database before applying this migration.

BEGIN;

DROP VIEW IF EXISTS recordscan_all;

-- Retained registration/BOM rows use the canonical typed category keys.
UPDATE bomlist
SET product_category = CASE lower(product_category)
  WHEN 'ai' THEN 'ac'
  WHEN 'an' THEN 'ac'
  WHEN 'washing' THEN 'wm'
  ELSE lower(product_category)
END
WHERE product_category IS NOT NULL;

UPDATE registscan
SET product_category = CASE lower(product_category)
  WHEN 'ai' THEN 'ac'
  WHEN 'an' THEN 'ac'
  WHEN 'washing' THEN 'wm'
  ELSE lower(product_category)
END
WHERE product_category IS NOT NULL;

-- Collapse old AC aliases into the canonical product category without breaking model links.
DO $$
DECLARE
  v_canonical_id uuid;
BEGIN
  SELECT id INTO v_canonical_id FROM product_categories WHERE slug = 'ac';
  IF v_canonical_id IS NULL THEN
    SELECT id INTO v_canonical_id
    FROM product_categories
    WHERE slug IN ('ai', 'an')
    ORDER BY CASE slug WHEN 'an' THEN 1 ELSE 2 END
    LIMIT 1;
    IF v_canonical_id IS NOT NULL THEN
      UPDATE product_categories SET slug = 'ac' WHERE id = v_canonical_id;
    END IF;
  END IF;

  IF v_canonical_id IS NOT NULL THEN
    UPDATE model m
    SET category_id = v_canonical_id
    FROM product_categories c
    WHERE c.slug IN ('ai', 'an') AND m.category_id = c.id;
    DELETE FROM product_categories
    WHERE slug IN ('ai', 'an') AND id <> v_canonical_id;
  END IF;
END $$;

DO $$
DECLARE
  v_canonical_id uuid;
BEGIN
  SELECT id INTO v_canonical_id FROM product_categories WHERE slug = 'wm';
  IF v_canonical_id IS NULL THEN
    SELECT id INTO v_canonical_id FROM product_categories WHERE slug = 'washing';
    IF v_canonical_id IS NOT NULL THEN
      UPDATE product_categories SET slug = 'wm' WHERE id = v_canonical_id;
    END IF;
  END IF;

  IF v_canonical_id IS NOT NULL THEN
    UPDATE model m
    SET category_id = v_canonical_id
    FROM product_categories c
    WHERE c.slug = 'washing' AND m.category_id = c.id;
    DELETE FROM product_categories
    WHERE slug = 'washing' AND id <> v_canonical_id;
  END IF;
END $$;

-- Do not silently discard a still-active row that has no typed replacement.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM bomlist b
    WHERE b.is_active
      AND NOT EXISTS (SELECT 1 FROM ac_bom_spec a WHERE a.bom_id = b.id)
      AND NOT EXISTS (SELECT 1 FROM wm_bom_spec w WHERE w.bom_id = b.id)
  ) THEN
    RAISE EXCEPTION 'Active BOM rows without typed specifications remain';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registscan r
    WHERE r.product_category NOT IN ('ac', 'wm')
       OR r.product_category IS NULL
       OR (r.product_category = 'ac' AND NOT EXISTS (SELECT 1 FROM ac_registration_spec a WHERE a.id_regist = r.id))
       OR (r.product_category = 'wm' AND NOT EXISTS (SELECT 1 FROM wm_registration_spec w WHERE w.id_regist = r.id))
  ) THEN
    RAISE EXCEPTION 'Registrations without typed specifications remain';
  END IF;
END $$;

-- Archived BOM rows with no typed replacement are obsolete legacy rules.
DELETE FROM bomlist b
WHERE NOT EXISTS (SELECT 1 FROM ac_bom_spec a WHERE a.bom_id = b.id)
  AND NOT EXISTS (SELECT 1 FROM wm_bom_spec w WHERE w.bom_id = b.id);

DROP TABLE IF EXISTS legacy_component_quarantine;
DROP TABLE IF EXISTS recordscan;

ALTER TABLE bomlist
  DROP COLUMN IF EXISTS sn_carton,
  DROP COLUMN IF EXISTS pcb_idu,
  DROP COLUMN IF EXISTS sn_box,
  DROP COLUMN IF EXISTS sn_motor,
  DROP COLUMN IF EXISTS sn_accessories,
  DROP COLUMN IF EXISTS sn,
  DROP COLUMN IF EXISTS components,
  DROP COLUMN IF EXISTS unit_map;

ALTER TABLE registscan
  DROP COLUMN IF EXISTS sn,
  DROP COLUMN IF EXISTS sn_carton,
  DROP COLUMN IF EXISTS pcb_idu,
  DROP COLUMN IF EXISTS sn_box,
  DROP COLUMN IF EXISTS sn_motor,
  DROP COLUMN IF EXISTS sn_accessories,
  DROP COLUMN IF EXISTS sn_odu,
  DROP COLUMN IF EXISTS components,
  DROP COLUMN IF EXISTS fields_snapshot;

ALTER TABLE product_categories
  DROP COLUMN IF EXISTS fields;

ALTER TABLE users
  DROP COLUMN IF EXISTS password;

ALTER TABLE bomlist
  ALTER COLUMN product_category SET NOT NULL,
  ADD CONSTRAINT bomlist_product_category_check CHECK (product_category IN ('ac', 'wm'));

ALTER TABLE registscan
  ALTER COLUMN product_category SET NOT NULL,
  ADD CONSTRAINT registscan_product_category_check CHECK (product_category IN ('ac', 'wm'));

-- Keep one reporting shape for the typed tables only.
CREATE VIEW recordscan_all AS
SELECT id, id_regist, sn, sn_odu, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories, timestamps, 'ac'::text AS product_category
FROM recordscan_ac
UNION ALL
SELECT id, id_regist, sn, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, timestamps, 'wm'::text AS product_category
FROM recordscan_wm;

COMMIT;
