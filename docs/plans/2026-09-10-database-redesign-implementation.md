# Database redesign implementation plan

## Purpose

Implement the accepted database design in safe expand, backfill, cutover, and contract releases. Every database change is additive until production reconciliation and rollback sign-off are complete.

This plan targets the repository's current Prisma 6.12/PostgreSQL stack. Generated migrations must be created with `prisma migrate dev --create-only`, reviewed, and amended with explicit SQL for backfill, partial indexes, checks, and compatibility views. Never use `prisma db push` for this rollout.

## Current-state facts

- The original generic `recordscan` table was dropped by migration `20260908110000_drop_legacy_scan_storage`.
- Current scan writes go to `recordscan_ac` and `recordscan_wm`.
- `recordscan_all` is a reporting view over those category tables.
- `bomlist` currently duplicates model and category text and owns one typed AC or WM specification.
- `registscan` currently duplicates order, model, PO, category, subline, user, shift, and plan text.
- Registration references live in `ac_registration_spec` or `wm_registration_spec`.
- Route ordering is hard-coded and inferred from `subline` strings in `src/services/scan.js`.
- Dashboard and exports depend on `recordscan_all` and the legacy response shape.
- Existing migrations do not form a clean baseline from an empty database because their first migration assumes pre-existing legacy tables.

## Target relationship map

```text
product_categories
└── model
    ├── model_bom_templates ── component_types
    └── model_route_steps ──── processes

bomlist (Production Order)
├── bomlist_components ─────── component_types
├── bomlist_route_steps ────── processes
├── registscan
│   ├── registscan_components ─ component_types
│   └── recordscan ──────────── production_units
└── production_units
    └── production_unit_components ─ component_types

audit_events records protected mutations without owning domain rows.
```

## Constraint decisions

### `bomlist`

- `order_number` is normalized and globally unique.
- `model_id` is a required FK to `model.id` after backfill.
- `po_number` is optional reference data.
- `order_quantity` is a positive integer.
- Status is constrained to `draft`, `released`, `active`, `completed`, or `cancelled`.
- Existing `model` and `product_category` strings remain during compatibility, then become derived response fields rather than stored sources of truth.

### `registscan`

- Add required relations to `bomlist`, `line`, and `bomlist_route_steps` after backfill.
- Add `production_date`; derive it from the existing timestamp in the configured business timezone.
- Preserve `shift` as controlled text initially to avoid unnecessary shift-master scope.
- `plan > 0` and cannot be lower than the active event count.
- Use `deleted_at`, `deleted_by`, and `delete_reason` for soft deletion.
- The application enforces one open Registration per order/date/shift/line/route step. Add a partial unique PostgreSQL index for active rows.

### `production_units`

- Store one row per normalized main serial.
- `serial_number` is globally unique and remains reserved after soft deletion.
- Each unit belongs to exactly one `bomlist` Production Order.
- Order quantity counts Production Units, not stage events.

### `recordscan`

- Recreate this name as the normalized per-stage event table.
- Store `registscan_id`, `production_unit_id`, and `bomlist_route_step_id`.
- Copy the route-step relation onto the event so historical uniqueness does not depend on later Registration edits.
- Enforce one active event per `(production_unit_id, bomlist_route_step_id)` with a PostgreSQL partial unique index.
- Store scanner user and timestamp plus soft-delete metadata.

### Components

- `component_types.code` is globally unique and stable.
- `bomlist_components` is unique on `(bomlist_id, component_type_id)`.
- `registscan_components` is unique on `(registscan_id, component_type_id)` and stores reference value, derived expected length, required state, and prefix snapshot.
- `production_unit_components` is unique on `(production_unit_id, component_type_id)`.
- `(component_type_id, serial_number)` is globally unique. Component serials remain reserved after soft deletion.
- No JSON component payload is part of the target write model.

## Phase 0 — repair migration reproducibility

### Deliverables

- Generate a baseline migration representing the schema immediately before the existing four migrations.
- Put it lexicographically before `20260906120000_category_specific_scan_tables`.
- On existing databases, mark only the new baseline as already applied with `prisma migrate resolve --applied` after verifying actual schema equivalence.
- Prove an empty test database can apply baseline plus all existing migrations.
- Record the `_prisma_migrations` state from a production copy before making changes.

### Safety gates

- Baseline SQL contains no production data.
- A schema diff between the clean migrated database and the current Prisma schema is understood and documented.
- Test tooling rejects any database name that does not contain `test`.

## Phase 1 — expand the schema

Update `apps/backend/prisma/schema.prisma` with the new models and nullable compatibility relations. Generate one create-only migration, then add:

- Native PostgreSQL check constraints for positive quantities and plans.
- Partial unique indexes for active Registration identity and active stage events.
- Case-normalized uniqueness using stored normalized serial values written by the application.
- Indexes on all FKs, timestamps, order status, order number, PO reference, and serial lookup columns.
- Seed inserts for AC/WM Component Types and process definitions.

Do not drop or rename current typed tables, columns, or `recordscan_all` in this phase.

## Phase 2 — preflight and quarantine

Create an idempotent preflight command under `apps/backend/scripts/` that reports without mutating:

- Duplicate or blank normalized order numbers.
- `bomlist` rows that cannot resolve exactly one model.
- Registrations that cannot resolve exactly one BOM/order.
- Unknown categories and category mismatches.
- Invalid, duplicate, or blank main serials by category and route stage.
- Component serials assigned to multiple main serials.
- Existing scans above Registration plans.
- Inferred Production Units above proposed order quantities.
- Subline names that cannot map to one line/process/route step.
- Same main serial appearing under different orders.

Write ambiguous rows to an idempotent quarantine table keyed by source table and source ID. The migration must stop before cutover when unresolved blocking rows remain.

## Phase 3 — backfill order and route data

In an idempotent data migration:

1. Resolve every `bomlist.model` string to `model.id` and populate `model_id`.
2. Normalize and validate globally unique `order_number` values.
3. Populate `order_quantity` from an explicitly approved source; do not infer it silently from a single Registration plan.
4. Seed model BOM templates from current supported category definitions.
5. Backfill `bomlist_components` from `ac_bom_spec` and `wm_bom_spec`.
6. Seed `processes`, model route templates, and order route snapshots from canonical current stages.
7. Map every `registscan.subline` to a physical `line` and order route step.
8. Link each Registration to its `bomlist` order and derive `production_date`.
9. Backfill `registscan_components`; calculate `expected_length` from normalized registration reference values.

All mappings produce before/after counts and reject ambiguous matches.

## Phase 4 — backfill units and stage events

Process `recordscan_ac` and `recordscan_wm` in deterministic timestamp/ID order:

1. Normalize the main serial.
2. Resolve or create one `production_units` row for the main serial and order.
3. Reject and quarantine a main serial associated with multiple orders.
4. Resolve component values into `production_unit_components`.
5. Reject and quarantine component ownership conflicts.
6. Create one normalized `recordscan` event for the source Registration and route step.
7. Preserve the source category table and source ID on the event during compatibility.
8. Detect duplicate unit/route-step events and quarantine rather than discard them.

Re-running the migration must update nothing and create no duplicate rows.

## Phase 5 — compatibility application release

### Backend repositories

Introduce focused repositories/services for:

- Production Order and order BOM loading.
- Registration creation, editing, plan validation, and soft deletion.
- Production Unit resolution and component ownership.
- Route progression validation.
- Unit Scan creation and soft deletion.
- Audit-event creation for PIN-protected operations.

Do not allow request payloads to select database tables. Resolve Component Types and routes through trusted relations.

### Write transaction

The scan transaction locks the Registration and Production Order, validates active state, plan, order quantity, reference length, BOM prefix, component ownership, and prior route events, then creates/resolves the Production Unit and inserts the stage event. Unique constraints translate to stable operator-facing errors.

### API compatibility

- Preserve current endpoint paths and response field names initially.
- Adapt normalized component rows into current AC/WM response shapes at the boundary.
- Replace hard-coded route parsing in `src/services/scan.js` with ordered route relations.
- Continue using `idregist` compatibility headers while accepting body/path IDs where already supported.
- Structural Registration edits after scans exist invoke PIN middleware, full revalidation, and `audit_events`.
- Deletes become soft deletes; list, dashboard, and export queries exclude deleted rows.

## Phase 6 — reporting cutover

- Replace `recordscan_all` with a compatibility view over normalized `recordscan`, `production_units`, and component relations, or move reporting to explicit repository queries.
- Count Production Units for order output and `recordscan` events for per-stage output.
- Reconcile dashboard, history, PO summaries, and Excel exports against both definitions.
- Include category-specific component columns only at presentation/export boundaries.
- Add explicit indexes based on `EXPLAIN ANALYZE` for real dashboard and export filters.

## Phase 7 — frontend cutover

- Keep Regist as the only operator-facing setup workflow.
- Add order quantity to the existing BOM form.
- Load component definitions from normalized order BOM rows.
- Derive and display expected length after Registration references are entered.
- Allow normal edits to date, shift, plan, and reference values.
- Request PIN only when the backend marks an edit as structural/protected or for delete/restore.
- Display plan progress and order progress separately.
- Remove fuzzy-accuracy messages and dynamic JSON-component assumptions.

## Phase 8 — verification gates

### Database

- Prisma validate and generate succeed.
- Clean migration from zero succeeds.
- Migration is idempotent on a copied production dataset.
- Source and target counts reconcile per order, category, Registration, and route step.
- Sampled serial/component ownership matches source records.
- All quarantined rows have explicit resolution status.

### Backend

- Concurrent scans cannot exceed Registration plan or order quantity.
- The same unit can traverse successive route steps but cannot repeat one route step.
- A serial cannot cross Production Orders.
- Component ownership cannot cross units.
- Length and prefix validation use the Registration snapshot.
- Structural edits require PIN after the first scan.
- Soft delete/restore preserves traceability and constraints.
- AC and WM history/export parity tests pass.

### Frontend

- Regist create/edit/delete and PIN flows pass in Playwright.
- Barcode-only repeated scanning keeps focus and returns actionable errors.
- Dashboard and export totals match normalized database queries.

## Phase 9 — contract release

Only after the rollback window and written sign-off:

- Stop compatibility writes and reads.
- Archive then drop `recordscan_ac`, `recordscan_wm`, AC/WM registration-spec tables, and AC/WM BOM-spec tables.
- Remove duplicated text category/model/order/subline fields after every consumer uses relations.
- Remove the old `recordscan_all` compatibility shape if no external consumer requires it.
- Keep audit and quarantine records according to the agreed retention policy.
- Generate and review a separate destructive contract migration; never combine it with expand/backfill.

## Recommended delivery slices

1. Baseline and preflight tooling.
2. Additive target schema and seed data.
3. Idempotent backfill with reconciliation reports.
4. Normalized scan/Registration services behind compatibility responses.
5. Reporting and frontend cutover.
6. Production verification and delayed legacy cleanup.

Each slice should be independently deployable and should leave the previous read path available until its replacement is verified.
