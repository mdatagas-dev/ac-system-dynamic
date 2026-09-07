-- recordscan_all must expose every legacy scan. Old registrations without
-- product_category (or 'ai'/'an' aliases) were invisible to total-po-scan,
-- dashboard, and export-odf-po-* — those rows predate the category columns.
-- The exports only read sn/sn_carton/pcb_idu/sn_box/sn_motor/sn_accessories,
-- which exist on recordscan for all legacy rows.
CREATE OR REPLACE VIEW recordscan_all AS
SELECT id, id_regist, sn, sn_odu, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories, timestamps, 'ac'::text AS product_category
FROM recordscan_ac
UNION ALL
SELECT id, id_regist, sn, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, timestamps, 'wm'::text AS product_category
FROM recordscan_wm
UNION ALL
SELECT s.id, s.id_regist::uuid, s.sn, s.sn_odu, s.sn_carton, s.pcb_idu, s.sn_box, s.sn_motor, s.sn_accessories, s.timestamps, COALESCE(NULLIF(r.product_category, ''), 'ac')::text
FROM recordscan s
JOIN registscan r ON r.id = s.id_regist::uuid
WHERE s.id_regist ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (r.product_category IS NULL OR r.product_category NOT IN ('ac', 'wm') OR r.product_category IN ('ai', 'an'));
