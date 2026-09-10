# Database redesign

## Objective

Replace duplicated category-specific scan storage and text-based relationships with a clean relational model while preserving all production history and the familiar core table names: `bomlist`, `registscan`, `recordscan`, `model`, `line`, `users`, `pin`, `uph`, and `product_categories`.

The operator workflow remains centered on Regist. Normal edits happen in the registration form; PIN authorization appears only for deletion or rare structural changes after scanning begins.

## Business decisions

- `order_number` is globally unique.
- One `bomlist` row represents one Production Order and owns its order-specific BOM.
- `po_number` is optional reference data and does not define a batch.
- A Product Model provides a BOM template and route template; these are copied to the Production Order so history remains stable.
- `bomlist.order_quantity` is the hard overall ceiling for unique finished units.
- `registscan.plan` is the hard ceiling for active scans in one Registration.
- Operators may increase or decrease a Registration plan, but not below its active scan count or beyond the Production Order's remaining quantity.
- Registration reference values define scan length. Scan validation uses length, BOM prefix, uniqueness, and route order; fuzzy accuracy comparison is removed.
- The main unit serial is globally unique. Component serials are unique within their Component Type.
- Operators may edit every Registration field. Structural changes after scans exist require a valid PIN and are audited.
- Registrations and scans use soft deletion.

## Proposed structure

### Existing core tables retained

`product_categories`
: Product family master, including AC and WM.

`model`
: Product Model master. Add a unique model code and retain its category relation.

`line`
: Physical production line master. Line identity is separated from process and route step.

`users`, `pin`, `uph`
: Retain their names and responsibilities. PIN values must never be copied into audit records.

`bomlist`
: Production Order and BOM parent. Important columns are `id`, globally unique `order_number`, `model_id`, optional `po_number`, positive `order_quantity`, lifecycle status, timestamps, and soft-delete metadata if orders can be retired.

`registscan`
: Operator-editable Registration. Important columns are `bomlist_id`, `production_date`, `shift`, `line_id`, `order_route_step_id`, positive `plan`, status, creator/updater timestamps, and soft-delete metadata.

`recordscan`
: One Unit Scan event at the route step represented by its Registration. Important columns are `registscan_id`, `production_unit_id`, scanning user and timestamp, plus soft-delete metadata. A unit may have one active event per order route step.

### New normalized supporting tables

`component_types`
: Controlled material kinds. Columns include stable `code`, label, category, and active state.

`model_bom_templates`
: Default component requirements for a Product Model.

`bomlist_components`
: Order-specific BOM Requirements copied from the model template. Unique on `(bomlist_id, component_type_id)` and stores prefix and required state.

`registscan_components`
: Registration References. Unique on `(registscan_id, component_type_id)` and stores the normalized reference value, derived expected length, required flag, and BOM-prefix snapshot.

`production_units`
: Stable identity of one physical finished unit. It belongs to one `bomlist` Production Order and has a globally unique normalized main serial.

`production_unit_components`
: Component serials assigned to a Production Unit. Unique on `(production_unit_id, component_type_id)` and globally unique on `(component_type_id, serial_number)`. Later route steps verify these assignments rather than creating duplicate component ownership rows.

`processes`
: Controlled processes such as Assembly, Testing, and Packing.

`route_steps`
: Model route-template steps, each referencing a process and stage/direction with an explicit sequence.

`bomlist_route_steps`
: Production Order route snapshot copied from the selected model. Registrations reference these rows rather than parsing `subline` text.

`audit_events`
: Append-only record of PIN-protected edits, deletes, restores, and serial-release actions. It stores entity identity, action, before/after values, reason, actor, authorization reference, and timestamp, but never the PIN itself.

## Validation and transaction boundaries

Creating a Unit Scan is one database transaction. It locks the Registration and then verifies:

1. Registration and Production Order are active.
2. Active stage-event count is below `registscan.plan`.
3. Creating a new Production Unit would not exceed `bomlist.order_quantity`; scanning an existing unit at a later stage does not consume the quantity again.
4. Required scan and component values are present.
5. Values match the expected Registration lengths.
6. Values contain the snapshotted BOM prefixes.
7. The main serial resolves to one Production Unit and component assignments do not conflict with another unit.
8. The unit has completed every required preceding order route step.

Database unique constraints are the final concurrency guard; application checks exist to return operator-friendly errors.

Plan edits lock the Registration and reject values below its active scan count. Structural edits after the first active scan require PIN authorization and full route/uniqueness revalidation. Existing scans remain attached to the edited Registration and the change is recorded in `audit_events`.

Deleting a Registration soft-deletes its scans in the same transaction. Restoring it restores child scans only when uniqueness, plan, order-quantity, and route constraints still hold. Soft-deleted serials remain reserved unless a separate PIN-authorized action releases them.

## Migration strategy

The migration must be additive and reversible until verified:

1. Take and verify a production backup; record source counts by category and registration.
2. Add new tables, nullable foreign keys, audit metadata, and constraints that do not invalidate legacy data.
3. Seed Component Types, processes, and explicit route steps from the current AC/WM definitions and line names.
4. Convert current `bomlist` rows into Production Orders and move typed AC/WM specifications into `bomlist_components`.
5. Backfill Registration References and derived lengths into `registscan_components`.
6. Resolve globally unique main serials into `production_units`, assign their components in `production_unit_components`, and merge `recordscan_ac` and `recordscan_wm` rows into per-stage `recordscan` events while preserving original IDs and timestamps where possible.
7. Quarantine malformed, unknown-category, or unmappable values; never silently discard them.
8. Compare counts and representative values, then dual-read or use compatibility views during validation.
9. Switch application writes to the normalized schema and monitor mismatches.
10. Retain category-specific legacy tables read-only through the agreed rollback period; remove them only after explicit production sign-off.

Migration scripts must be idempotent and must refuse any test database whose name does not identify it as a test database.

## Verification

- Prisma schema validation and client generation.
- Clean-database migration from zero.
- Idempotent migration against a recent production copy.
- Row-count and sampled field-by-field reconciliation.
- Integration tests for plan and order ceilings, prefix and length validation, route ordering, concurrency, soft delete/restore, structural-edit PIN rules, and AC/WM migration parity.
- Frontend flows for Registration creation/editing and category-aware scanning.
- Dashboard and export totals reconciled against active normalized scans.

## Explicit non-goals

- No JSON-based dynamic component values.
- No separate operator-facing Production Order or Production Run workflow.
- No fuzzy scan-accuracy comparison.
- No category-specific `recordscan_ac`/`recordscan_wm` write model after cutover.
- No permanent deletion of production traceability records through normal application workflows.
