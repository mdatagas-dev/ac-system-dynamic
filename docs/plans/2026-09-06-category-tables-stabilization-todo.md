# Category-specific tables — stabilization and operator UX TODO

## Objective

Finish and stabilize the AC/WM category-table migration before production rollout, then simplify the operator workflow without introducing unnecessary architecture.

## Scope rules

- **Plan is fixed per registration, not per BOM.** When a batch reaches its registered plan, scanning is blocked. To continue production, the operator creates a new registration with its own plan.
- AC fields: `sn`, `sn_odu`, `sn_carton`, `pcb_idu`, `sn_box`, `sn_motor`, `sn_accessories`.
- Provisional WM fields: `sn`, `sn_drum`, `sn_pump`.
- Canonical washing-machine slug: `wm`.
- Preserve current BOM prefix, required-field, accuracy, duplicate, and AC stage-order rules.
- Do not drop legacy tables or JSONB during stabilization.
- Do not run migration or E2E tests against `ac_production`.
- Do not add offline mode, workflow engines, or generic plugin systems.

---

## Phase 0 — Restore a safe development baseline

**Goal:** make all verification commands safe and runnable.

- [x] Restore `apps/backend/.env.example` without real credentials.
- [x] Restore `apps/backend/.env.test` with a dedicated test database URL.
- [x] Confirm the backend test guard rejects any database name without `test`.
- [x] Change Playwright setup to use an explicit dedicated test database URL.
- [x] Remove the hardcoded `ac_production` URL from Playwright setup.
- [ ] Take a database backup before testing the backfill against a production copy.
- [ ] Record baseline counts for `bomlist`, `registscan`, and `recordscan` by category.

### Exit gate

- [ ] `pnpm test` can start without accessing production.
- [ ] Playwright setup cannot connect to production accidentally.

---

## Phase 1 — Fix field metadata and validation

**Goal:** ensure AC/WM forms and validation use the correct fields.

- [x] Use one universal BOM field set for every AC unit:
  - [x] `fieldsForCategory(category, spec)` returns every category field.
  - [x] IDU and ODU no longer filter the BOM field set.
- [x] Return all category field metadata from `/bomlist`.
- [x] Return the universal BOM field set from `/rdps/scan`.
- [ ] Verify IDU and ODU receive every configured AC BOM field.
- [ ] Verify WM receives only `sn`, `sn_drum`, and `sn_pump`.
- [ ] Backfill AC `required` settings from `product_categories.fields`.
- [ ] Preserve per-BOM prefix values during backfill.
- [ ] Decide one source of truth for field metadata:
  - [ ] Keep typed BOM specification columns as the source of truth.
  - [ ] Make the old category-template editor read-only or remove it after cutover.
- [ ] Reject unsupported category slugs when creating/editing models or categories.
- [ ] Add clear `UNSUPPORTED_CATEGORY` and `MISSING_CATEGORY_SPEC` responses.

### Tests first

- [ ] Test all AC fields are returned by the BOM endpoint.
- [ ] Test AC endpoints expose the same BOM field set for IDU and ODU.
- [ ] Test WM returns exactly its three provisional fields.
- [ ] Test migrated required metadata matches legacy configuration.
- [ ] Test unsupported categories fail clearly.

### Exit gate

- [ ] Existing required fields cannot silently become optional.
- [ ] Scanner field lists match the registration line and category.

---

## Phase 2 — Make the migration safe and reproducible

**Goal:** support clean test databases and safe legacy backfill.

- [ ] Create a proper baseline migration for the existing schema, or document and script Prisma baselining for existing databases.
- [ ] Verify a clean test database can run all migrations from zero.
- [ ] Add explicit native database types in Prisma so schema and SQL agree (`VarChar(255)`, etc.).
- [ ] Add preflight queries for malformed `recordscan.id_regist` values.
- [ ] Do not cast malformed IDs directly to UUID during backfill.
- [ ] Assign missing categories from the related model/BOM where unambiguous.
- [ ] Quarantine ambiguous or unsupported category rows.
- [ ] Quarantine unknown JSON keys from all three sources:
  - [ ] `bomlist.components`
  - [ ] `registscan.components`
  - [ ] `recordscan.components`
- [ ] Make quarantine insertion idempotent with a database uniqueness constraint.
- [ ] Backfill AC and WM BOM specifications.
- [ ] Backfill AC and WM registration specifications.
- [ ] Backfill AC and WM scan records.
- [ ] Verify source/destination counts per category.
- [ ] Verify representative rows field-by-field.
- [ ] Verify rerunning the backfill does not duplicate data.
- [ ] Keep legacy storage unchanged for rollback.

### Exit gate

- [ ] Clean-database migration passes.
- [ ] Copied-production-data migration passes.
- [ ] No supported values are dropped.
- [ ] Unknown values are present in quarantine.

---

## Phase 3 — Complete backend behavior

**Goal:** preserve existing behavior while using typed tables.

- [ ] Include typed registration reference values in registration list/detail responses.
- [ ] Ensure editing a registration preserves unchanged reference values.
- [ ] Prevent changing a registration category after scans exist.
- [ ] Keep the parent `registscan` row lock during scan creation.
- [ ] Use normalized equality for duplicate serial checks.
- [ ] Preserve AC stage-order checks.
- [ ] Preserve registration-reference accuracy checks.
- [ ] Restore scan response data currently lost:
  - [ ] Brand
  - [ ] Packing/unit aggregation if still used by the frontend
- [ ] Route bulk import through the same validation path as interactive scanning.
- [ ] Validate edit operations with BOM, accuracy, and duplicate rules.
- [ ] Delete both typed and legacy scan rows during the compatibility period.
- [ ] Restore BOM search by serial prefix if users rely on it.
- [ ] Replace registration-list N+1 counts with at most one grouped count query per category.
- [ ] Keep API response names/status codes compatible unless intentionally versioned.

### Fixed plan behavior

- [x] Confirmed: scanning beyond `plan` is forbidden.
- [x] Keep `PLAN_REACHED`.
- [x] Direct the operator to create a new registration to continue production.
- [ ] Do not add a plan-extension workflow to this release.

### Tests first

- [ ] AC registration create/edit/detail.
- [ ] WM registration create/edit/detail.
- [ ] AC and WM scan create/history/edit/delete.
- [ ] Duplicate scan under concurrent requests.
- [ ] Accuracy failure and BOM-prefix failure.
- [ ] AC input/output and packing stage order.
- [ ] Bulk import parity with interactive scan.
- [ ] Registration deletion during compatibility mode.
- [ ] Plan reached/over-plan behavior after business confirmation.

### Exit gate

- [ ] Full backend integration suite passes.
- [ ] Existing AC workflow behavior remains compatible.
- [ ] WM workflow works with provisional fields.

---

## Phase 4 — Complete category-aware reporting

**Goal:** make history, dashboard, and exports correct for AC and WM.

- [ ] Keep `recordscan_all` as a read-only reporting view.
- [ ] Verify dashboard totals against typed table counts.
- [ ] Make history metadata category-aware.
- [ ] Return AC columns for AC history.
- [ ] Return `sn`, `sn_drum`, and `sn_pump` for WM history.
- [ ] Include WM fields in detailed exports.
- [ ] Include category in cross-category exports.
- [ ] Test filters, pagination, totals, and timestamps for both categories.

### Exit gate

- [ ] Dashboard totals equal category-table totals.
- [ ] AC and WM exports contain their expected fields.

---

## Phase 5 — Minimal admin UX correction

**Goal:** prevent administrators from entering irrelevant or ignored data.

- [ ] When a model is selected in BOM entry, determine its category.
- [ ] Show only AC fields for AC models.
- [ ] Show only `sn`, `sn_drum`, and `sn_pump` for WM models.
- [ ] Hide the legacy category-template editor if its values are no longer used.
- [ ] Display required/optional state directly beside each BOM field.
- [ ] Use consistent Indonesian labels:
  - [ ] `Cari`, not `Search`
  - [ ] `Tambah`, not `Create`
  - [ ] `Scan terakhir`, not `Last Scan`
- [ ] Preserve entered BOM values when validation fails.

### Exit gate

- [ ] Admin cannot accidentally configure AC fields for WM or WM fields for AC.
- [ ] No visible control writes configuration ignored by the backend.

---

## Phase 6 — Minimal operator registration flow

**Goal:** reduce the steps required to resume or create production work.

- [ ] Make `/regist` the PPC landing page.
- [ ] Put incomplete batches at the top, newest/current shift first.
- [ ] Give each incomplete batch one primary action: `Lanjut Scan`.
- [ ] Show completed batches below or behind `Lihat batch selesai`.
- [ ] Rename primary actions to Indonesian.
- [ ] Simplify new registration field order:
  1. [ ] Model
  2. [ ] Order Number
  3. [ ] PO Number
  4. [ ] Plan
  5. [ ] Shift
  6. [ ] Category-specific reference values
- [ ] Use a select for shift rather than free text.
- [ ] Keep line/subline derived from the authenticated operator.
- [ ] Show all category reference fields from the universal BOM.
- [ ] Navigate directly to scan after successful registration.
- [ ] Hide destructive/admin actions from PPC users unless operationally required.
- [ ] Reduce crowded row actions to:
  - [ ] Primary `Lanjut Scan`
  - [ ] Secondary overflow/menu for detail, history, edit, delete

### Exit gate

- [ ] Operator can resume an incomplete batch with one click.
- [ ] Operator can create a batch without seeing irrelevant category fields.

---

## Phase 7 — Minimal scanner UX

**Goal:** optimize for barcode-gun operation and rapid error recovery.

- [ ] Add a registration selector when `/scan` is opened without `idregist`.
- [ ] Replace empty Suspense fallback with a visible loading state.
- [ ] Keep a compact sticky header showing:
  - [ ] Model
  - [ ] Order/PO
  - [ ] Line
  - [ ] Progress: `count / plan`
- [ ] Use input height of at least 48–56px.
- [ ] Add meaningful `name`, `aria-label`, and `autocomplete="off"` to scan inputs.
- [ ] Use visible `focus-visible` styles.
- [ ] Keep focus on the next required field.
- [ ] Prevent submission while a scan request is active.
- [ ] On success:
  - [ ] Clear fields
  - [ ] Return focus to the first field
  - [ ] Show a short non-blocking green confirmation
  - [ ] Do not require dismissing success
- [ ] On failure:
  - [ ] Preserve entered values
  - [ ] Focus/select the failing field where identifiable
  - [ ] Show one short Indonesian reason
  - [ ] Keep the error visible until corrected/dismissed
- [ ] Respect reduced-motion preference for the red screen flash.
- [ ] Optionally add a simple sound toggle for success/failure; do not add a notification framework.
- [x] When the batch reaches plan, show an explicit completion panel and `Kembali ke Registrasi`.

### Exit gate

- [ ] A barcode-only operator can complete repeated scans without touching the mouse.
- [ ] Failures preserve work and clearly identify the correction needed.

---

## Phase 8 — Category-aware operator history

**Goal:** show useful correction data without a generic complex table.

- [ ] Show the latest 10 scans first.
- [ ] Render category-specific columns:
  - [ ] AC: SN, ODU, PCB, motor, box, carton, accessories as applicable
  - [ ] WM: SN, drum, pump
- [ ] Remove the obsolete `Komponen Dinamis` column.
- [ ] Keep delete/correction behind confirmation.
- [ ] Reset pagination when registration or search changes.
- [ ] Add visible loading and error states.

### Exit gate

- [ ] WM history no longer displays empty AC columns.
- [ ] Operators can confirm the most recent scans quickly.

---

## Phase 9 — Final verification and rollout

- [ ] Run `prisma validate`.
- [ ] Generate Prisma Client.
- [ ] Run backend unit tests.
- [ ] Run backend integration tests.
- [ ] Run frontend lint with zero errors.
- [ ] Run frontend production build.
- [ ] Run AC Playwright flow against the test database.
- [ ] Run WM Playwright flow against the test database.
- [ ] Run migration/backfill against a recent production database copy.
- [ ] Compare pre/post counts and sampled values.
- [ ] Deploy additive migration first.
- [ ] Deploy typed reads/writes only after migration verification.
- [ ] Monitor scan errors and count mismatches.
- [ ] Keep legacy data available for the agreed rollback period.
- [ ] Remove legacy JSONB and `recordscan` only in a later, separately approved cleanup migration.

## Definition of done

- [ ] AC and WM scans use their typed tables.
- [ ] Required/prefix behavior matches the previous production behavior.
- [ ] Registration edit does not erase reference values.
- [ ] Dashboard, history, and exports support both categories.
- [ ] No test connects to production.
- [ ] Clean and copied-production database migrations pass.
- [ ] Backend tests, frontend lint/build, and Playwright pass.
- [ ] Operator can resume a batch in one click and scan without mouse interaction.
- [ ] Legacy storage remains available until a separately approved cleanup.
