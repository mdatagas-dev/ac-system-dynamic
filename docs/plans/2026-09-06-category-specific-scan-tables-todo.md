# Category-specific scan tables — implementation TODO

## Goal

Replace the generic JSONB component design with shared workflow tables and typed, category-specific tables.

Target structure:

```text
product_categories
model
bomlist
├── ac_bom_spec
└── wm_bom_spec

registscan
├── ac_registration_spec
└── wm_registration_spec

recordscan_ac
recordscan_wm
```

Initial category fields:

- AC: `sn`, `sn_odu`, `sn_carton`, `pcb_idu`, `sn_box`, `sn_motor`, `sn_accessories`
- WM (provisional): `sn`, `sn_drum`, `sn_pump`

WM fields may be extended later through normal Prisma/PostgreSQL migrations.

## Constraints

- Preserve existing BOM-prefix, required-field, unit, accuracy, duplicate-scan, and production-stage behavior.
- Store each category value in one place only; do not copy fixed columns into JSONB.
- Keep shared tables limited to category-independent metadata.
- Resolve the destination table from the trusted registration/category relationship, never from a client-provided table name.
- Migrate existing data without deleting or silently dropping unknown component values.
- Use a test database for all migration and integration testing.

## Phase 1 — Inventory and safety

- [ ] Restore or recreate `apps/backend/.env.test` with a test-only `DATABASE_URL`.
- [ ] Verify the test database guard rejects production database names.
- [ ] Back up the production database before applying any data migration.
- [ ] Inventory existing category slugs in `product_categories`.
- [ ] Inventory distinct keys currently stored in:
  - [ ] `bomlist.components`
  - [ ] `registscan.components`
  - [ ] `recordscan.components`
- [ ] Count rows whose category is missing, unknown, or inconsistent with the related model/BOM.
- [ ] Identify duplicate fixed values currently present in both columns and JSONB.
- [ ] Identify component keys that cannot map to the initial AC or WM schemas.
- [ ] Decide how unmapped legacy values will be quarantined; do not discard them.
- [ ] Confirm the canonical WM slug, for example `wm` or `washing`, and use one value everywhere.

## Phase 2 — Finalize typed field rules

- [ ] Define AC field metadata in one backend module:
  - [ ] Column name
  - [ ] User-facing label
  - [ ] Required/default-required behavior
  - [ ] IDU/ODU applicability
  - [ ] Prefix source
- [ ] Define provisional WM metadata for `sn`, `sn_drum`, and `sn_pump`.
- [ ] Decide whether required flags vary per BOM or are category constants.
- [ ] Decide whether field unit assignment varies per BOM or is a category constant.
- [ ] Replace runtime JSON field discovery with a category registry containing explicit field metadata.
- [ ] Add a hard error for unsupported category slugs.

## Phase 3 — Add new Prisma models

- [ ] Add `ac_bom_spec` with a one-to-one foreign key to `bomlist`.
- [ ] Add `wm_bom_spec` with a one-to-one foreign key to `bomlist`.
- [ ] Add `ac_registration_spec` with a one-to-one foreign key to `registscan`.
- [ ] Add `wm_registration_spec` with a one-to-one foreign key to `registscan`.
- [ ] Add `recordscan_ac` with a many-to-one foreign key to `registscan`.
- [ ] Add `recordscan_wm` with a many-to-one foreign key to `registscan`.
- [ ] Change category linkage to use a trusted relation or constrained category identifier where practical.
- [ ] Add `onDelete: Cascade` to category detail rows where deletion semantics permit it.
- [ ] Add indexes for registration ID, timestamp, and searchable serial fields.
- [ ] Add database uniqueness constraints for serial values where production rules require exact uniqueness.
- [ ] Ensure `id_regist` uses UUID rather than an unconstrained string in all new tables.
- [ ] Generate and review a real Prisma migration; do not use `db push` for production rollout.

## Phase 4 — Migration code and backfill

- [ ] Create an idempotent backfill script or SQL migration.
- [ ] Backfill `ac_bom_spec` from AC BOM fixed columns and valid JSON component data.
- [ ] Backfill `wm_bom_spec` from WM BOM JSON keys `sn`, `sn_drum`, and `sn_pump`.
- [ ] Backfill `ac_registration_spec` from AC registration columns/JSON.
- [ ] Backfill `wm_registration_spec` from WM registration columns/JSON.
- [ ] Backfill `recordscan_ac` from existing AC `recordscan` rows.
- [ ] Backfill `recordscan_wm` from existing WM `recordscan` rows.
- [ ] Normalize migrated serial values consistently, including case and whitespace.
- [ ] Write unknown category/component data to a quarantine table or export file.
- [ ] Verify source and destination row counts per category.
- [ ] Verify sampled records field-by-field.
- [ ] Verify no registration points to both AC and WM detail records.
- [ ] Keep old columns and tables during the compatibility period.

## Phase 5 — Backend category repository layer

- [ ] Introduce a category repository/strategy interface for:
  - [ ] Loading a BOM specification
  - [ ] Creating/updating a registration specification
  - [ ] Creating a scan
  - [ ] Loading scan history
  - [ ] Editing/deleting a scan
  - [ ] Counting scans
  - [ ] Exporting scans
- [ ] Implement the AC repository using `ac_*` tables.
- [ ] Implement the WM repository using `wm_*` tables.
- [ ] Dispatch by the category stored on the registration/model.
- [ ] Never construct SQL table names directly from request input.
- [ ] Lock the parent `registscan` row during scan creation to prevent first-scan races.
- [ ] Use normalized equality instead of substring matching for duplicate serial checks.

## Phase 6 — Preserve business validation

- [ ] Apply BOM-prefix checks to typed category fields.
- [ ] Apply required-field checks to typed category fields.
- [ ] Preserve registration-reference accuracy comparison.
- [ ] Preserve IDU/ODU field filtering for AC.
- [ ] Define applicable production stages for WM rather than inheriting AC stages accidentally.
- [ ] Enforce registration ownership on scan summary and history endpoints.
- [ ] Validate positive integer production plans.
- [ ] Prevent scans beyond plan if that is the required production rule.
- [ ] Route bulk import through the same validation pipeline as interactive scans.

## Phase 7 — Update routes and responses

- [ ] Update BOM CRUD to write the appropriate category BOM specification transactionally.
- [ ] Update registration CRUD to write shared metadata plus one category specification transactionally.
- [ ] Update `/rdps/post` to insert into `recordscan_ac` or `recordscan_wm`.
- [ ] Update `/rdps/scan` to return category-specific fields in a stable API shape.
- [ ] Update `/rdps/history` to query the correct scan table.
- [ ] Update edit and delete endpoints for category-specific scan records.
- [ ] Update scan counts and incomplete-registration queries to count the correct category table.
- [ ] Update exports to support both category tables.
- [ ] Update dashboard queries, using explicit `UNION ALL` views/queries if cross-category totals are required.
- [ ] Return a clear `400 UNSUPPORTED_CATEGORY` response for unknown categories.

## Phase 8 — Frontend updates

- [ ] Replace BOM JSON field discovery with field metadata returned by the backend category API.
- [ ] Ensure AC forms submit only AC fields.
- [ ] Add provisional WM forms for `sn`, `sn_drum`, and `sn_pump`.
- [ ] Stop sending fixed fields both at the payload root and in `components`.
- [ ] Remove `components` assumptions from registration, scan, history, and master-data pages.
- [ ] Show a clear unsupported-category message instead of rendering an empty scanner.
- [ ] Restore a registration selector on `/scan` for direct navigation.

## Phase 9 — Tests

- [ ] Write failing migration/backfill tests before implementing the migration.
- [ ] Add AC BOM, registration-reference, and scan repository tests.
- [ ] Add WM BOM, registration-reference, and scan repository tests.
- [ ] Test WM required `sn_drum` and optional `sn_pump` behavior.
- [ ] Test BOM-prefix mismatch for AC and WM.
- [ ] Test registration-reference accuracy for AC and WM.
- [ ] Test duplicate scans under concurrent requests.
- [ ] Test category isolation: an AC registration cannot create a WM scan and vice versa.
- [ ] Test unknown categories and unmapped legacy fields.
- [ ] Test history, count, dashboard, export, edit, delete, and bulk import for both categories.
- [ ] Update Playwright setup to use a dedicated test database, never `ac_production`.
- [ ] Add Playwright flows for one AC batch and one WM batch.
- [ ] Run backend unit and integration tests.
- [ ] Run frontend lint, build, and Playwright tests.

## Phase 10 — Cutover and cleanup

- [ ] Deploy additive schema changes first.
- [ ] Run and verify the backfill.
- [ ] Deploy category-aware reads and writes.
- [ ] Monitor unknown-category errors, count mismatches, and scan failures.
- [ ] Stop writing the legacy `recordscan` table and JSONB fields only after verification.
- [ ] Retain legacy data read-only for an agreed rollback period.
- [ ] Remove legacy `recordscan` only after backup and sign-off.
- [ ] Remove obsolete fixed/category component columns from shared tables.
- [ ] Remove `components`, `unit_map`, and `fields_snapshot` only after their behavior has typed replacements.
- [ ] Remove unused dynamic-component services and tests.
- [ ] Update API, database, deployment, and operational documentation.

## Definition of done

- [ ] AC scans are stored only in `recordscan_ac`.
- [ ] WM scans are stored only in `recordscan_wm`.
- [ ] Registration reference values are stored only in their category specification table.
- [ ] BOM values are stored only in their category specification table.
- [ ] No fixed field is duplicated inside JSONB.
- [ ] Existing supported records migrate with matching counts and values.
- [ ] Unknown legacy data is preserved for manual resolution.
- [ ] All validation behavior is covered by automated tests.
- [ ] Tests never connect to the production database.
- [ ] Lint, build, unit, integration, and E2E checks pass.
