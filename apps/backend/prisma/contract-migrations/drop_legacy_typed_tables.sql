-- Apply only after database-redesign-contract-readiness reports ready=true.
-- This is intentionally outside prisma/migrations until the rollback window ends.
BEGIN;

DROP VIEW IF EXISTS recordscan_all;

ALTER TABLE recordscan
  DROP CONSTRAINT IF EXISTS recordscan_legacy_source_table_legacy_source_id_key,
  DROP COLUMN IF EXISTS legacy_source_table,
  DROP COLUMN IF EXISTS legacy_source_id;

DROP TABLE IF EXISTS recordscan_ac;
DROP TABLE IF EXISTS recordscan_wm;
DROP TABLE IF EXISTS ac_registration_spec;
DROP TABLE IF EXISTS wm_registration_spec;
DROP TABLE IF EXISTS ac_bom_spec;
DROP TABLE IF EXISTS wm_bom_spec;

COMMIT;
