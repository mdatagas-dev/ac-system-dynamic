# Database — Prisma Schema

DB produksi: `ac_production` (PostgreSQL). Schema: `prisma/schema.prisma`. Client di-generate ke `src/generated/prisma`.

## Model

### users
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| username | varchar(255) | unik secara aplikasi (belum ada constraint DB) |
| hash | varchar(255) | bcrypt — satu-satunya penyimpanan password |
| email | varchar(255) | |
| roleuser | varchar(255) | `superuser` = akses semua data |
| departement / section | varchar(255) | |

> Kolom `password` (plaintext) **sudah dihapus** dari DB dan schema. Jangan menuliskannya kembali.

### registscan — registrasi batch
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| model | varchar(255) | + suffix 5 karakter; dicocokkan ke bomlist setelah dipotong |
| order_number / po_number | varchar(255) | |
| subline | varchar(255) | |
| userid | varchar(255) | pemilik registrasi |
| shift | varchar(255) | "1" / "2" |
| plan | int | target produksi |
| sn, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories | varchar | data registrasi opsional |
| timestamps | timestamptz | default now |

### recordscan — hasil scan per unit
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| id_regist | varchar(255) | → registscan.id (tanpa FK constraint, di-join via `::uuid`) |
| sn, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories | varchar(255) | |
| timestamps | timestamptz | |

Index: GIN trigram pada `id_regist`, btree pada setiap kolom `sn*` + `timestamps`.

### bomlist — data BOM per batch
`id, sn_carton, pcb_idu, sn_box, sn_motor, sn_accessories, order_number, sn, model, timestamps` (+ `is_active` default true di DB).

### model
`id, brand, model, pk (numeric), linkimage` — **tidak ada kolom `inch`**.

### line
`id, line` (disimpan UPPERCASE).

### uph
`id, model (uuid → model.id), line (uuid → line.id), uph (int)`.

### pin — PIN harian
`id, pin (int), date (date, default now)`.

## Catatan Penting

1. **relasi recordscan → registscan tanpa FK** — join memakai `rcd.id_regist::uuid = rgs.id`. Jangan menambah FK constraint tanpa migrasi hati-hati.
2. `registscan.model` punya suffix 5 karakter; validasi bomlist memotongnya (`model.slice(0, -5)`).
3. **DB test terpisah**: `ac_system_test` — test TIDAK boleh menyentuh `ac_production` (lihat docs/testing.md).
4. Migrasi schema → jalankan migration history ke DB test sebelum `npm test`:
   ```bash
   DATABASE_URL="postgresql://engineering@localhost:5433/ac_system_test?sslmode=disable" npx prisma migrate deploy
   ```

## Baseline migrasi

`prisma/migrations/0_legacy_baseline` merepresentasikan database sebelum Prisma
Migrate digunakan. Database produksi lama yang sudah memiliki tabel tersebut harus
menandai baseline sebagai applied setelah schema diverifikasi; baseline tidak boleh
dijalankan langsung pada database berisi data.

Database test kosong menjalankan baseline dan seluruh migration berikutnya secara
normal. Jangan gunakan `prisma db push` untuk rollout redesign karena perintah itu
melewati migration history dan custom SQL.

## Preflight redesign

Jalankan pemeriksaan read-only pada database test:

```bash
DATABASE_URL="postgresql://engineering@localhost:5433/ac_system_test?sslmode=disable" npm run db:preflight
```

Script keluar dengan status `2` bila konflik blocking ditemukan. Pemeriksaan
database produksi dinonaktifkan secara default dan hanya boleh dilakukan sebagai
operasi read-only yang direncanakan setelah backup dan persetujuan deployment.

Temuan blocking dapat disalin secara idempotent ke `migration_quarantine` pada
database test dengan konfirmasi eksplisit:

```bash
DATABASE_URL="postgresql://engineering@localhost:5433/ac_system_test?sslmode=disable" \
ALLOW_TEST_QUARANTINE=WRITE_TEST_QUARANTINE \
npm run db:quarantine
```

Peringatan seperti jumlah scan yang melebihi plan tetap report-only. Perintah
quarantine menolak seluruh database yang namanya tidak mengandung `test`; write
ke produksi baru boleh ditambahkan pada deployment phase setelah backup dan
review hasil preflight.

## Phase 3 normalized-data backfill

The Phase 3 writer is intentionally test-only. Order quantities must be supplied
from an approved JSON file because a Registration plan is a daily ceiling, not
the Production Order total. The file is an object keyed by order number:

```json
{
  "ODF-2026-001": 1000,
  "ODF-2026-002": 750
}
```

Run the backfill with an explicit confirmation:

```bash
ALLOW_TEST_PHASE3_BACKFILL=WRITE_TEST_PHASE3_BACKFILL \
BACKFILL_ORDER_QUANTITIES_FILE=/absolute/path/approved-order-quantities.json \
npm run db:backfill:phase3
```

The command normalizes Production Order numbers, links Product Models, copies
order BOM requirements, creates route templates and order route snapshots, and
links Registrations with their component reference-length snapshots. It rejects
missing quantities, ambiguous master data, unknown stages, missing physical
lines, and missing typed specifications before committing. Its JSON result
includes target-table counts from before and after the transaction for
reconciliation. Re-running it does not create duplicate normalized rows.

## Phase 4 Production Unit and Unit Scan backfill

Run Phase 4 only after Phase 3 has linked every Registration to its Production
Order and route step:

```bash
ALLOW_TEST_PHASE4_BACKFILL=WRITE_TEST_PHASE4_BACKFILL \
npm run db:backfill:phase4
```

The command reads legacy AC and WM scans in timestamp/ID order, creates one
Production Unit per normalized main serial, assigns component serials by
Component Type, and creates one Unit Scan per route step. Legacy source table and
row IDs remain on every normalized event for reconciliation.

No normalized rows are written when conflicts exist. Blank serials, missing
Phase 3 links, cross-order main serials, conflicting component ownership, changed
components on one unit, Production Units above the order quantity, and repeated
route-step events are written idempotently to `migration_quarantine`; the command
exits with status `2`. Production writes remain intentionally unsupported until
copied-data reconciliation and deployment approval are complete.

## Phase 5 compatibility writes

`POST /rdps/post` uses normalized validation when its Registration has completed
Phase 3 links. The transaction locks the Registration and Production Order,
serializes the main serial and component serials, and enforces:

- the Registration plan;
- the Production Order quantity;
- Registration reference lengths and BOM prefix snapshots;
- global main-serial ownership by Production Order;
- component ownership by Component Type; and
- completion of every earlier required route step.

The same transaction writes the normalized Production Unit, component ownership,
and Unit Scan plus the legacy `recordscan_ac` or `recordscan_wm` row. The legacy
row keeps existing history, dashboard, export, and response contracts working.
Registrations without normalized links continue through the legacy path during
the rollout window. The normalized path intentionally omits fuzzy accuracy
matching.

Normalized Production Orders also create normalized Registrations through the
existing `POST /registscan/post` endpoint. The endpoint resolves the physical
line and order route step and snapshots each Registration reference, expected
length, required flag, and BOM prefix.

For normalized Registrations, edits cannot reduce the plan below active Unit
Scans. Date/shift/plan changes remain normal edits; changing the Production
Order, physical line, route step, or Registration references after scanning
requires the daily PIN and a reason. Protected edits create an `audit_events`
record. Delete also requires PIN and reason, sets the Registration soft-delete
fields, records an audit event, and hides the Registration from normal lists.
Legacy Registrations retain their compatibility behavior until backfilled.

Normalized scan reads also keep the existing API contract. `GET /rdps/scan`,
`GET /rdps/history`, and `GET /rdps/history.xlsx` read active Unit Scan events
and adapt Production Unit/component data into the legacy response columns.
Soft-deleted Unit Scans are excluded from totals, history, and exports.

Deleting a normalized Unit Scan requires the daily PIN and a reason. The
endpoint soft-deletes the Unit Scan, records an `audit_events` entry, and removes
its compatibility row from the legacy typed scan table so old reports cannot
show the deleted event. Legacy-only scans retain their compatibility behavior
until their Registration is backfilled.

Editing a normalized scan is a Production Unit identity correction, not an
isolated event rewrite. It requires the daily PIN and a reason, revalidates the
Registration length and BOM prefix snapshots, enforces global unit/component
ownership, updates the Production Unit and its components, synchronizes every
surviving legacy compatibility row for that unit, and records an audit event.

## Database reconciliation gate

After Phase 3 and Phase 4 backfill, run the read-only database gate against the
test copy:

```bash
npm run db:reconcile
```

The command fails with exit status `2` until legacy/normalized active scan
counts match globally and per order/Registration/route, Production Unit counts
match distinct source serials per order, every legacy row has a normalized event,
normalized links are complete, Production Unit totals remain within order
quantity, serial/component values match their legacy source rows, and every
quarantine entry has an explicit resolution. It refuses database names that do
not contain `test`.

## Component-only scan schema

Route templates and Production Order route snapshots now include
`requires_main_serial`. Existing routes default to `true`. A route such as
`WM ASSY PCB` can set it to `false`, allowing its Unit Scan event to have no
`production_unit_id`.

Scanned component values belong to `recordscan_components`. Each event may hold
any Component Types snapshotted by its Registration. Component serials are
unique per Component Type and Route Step, remain reserved after soft deletion,
and can exist without a Production Unit. Component-only events count against
the Registration plan only; Production Order quantity and unit-route progression
apply only when the route requires a main serial.

Migration `20260911023000_component_only_scan_events` is additive. It does not
change existing routes or events because `requires_main_serial` defaults to
`true` and all existing normalized events retain their Production Unit relation.
Backend write support is a later phase; applying this migration alone does not
enable component-only API payloads.

Prove the complete migration history against a newly created temporary database:

```bash
ALLOW_CLEAN_MIGRATION_VERIFY=VERIFY_CLEAN_TEST_MIGRATIONS \
npm run db:verify:migrations
```

The verifier requires the configured base database name to contain `test`, gives
the temporary database a generated `ac_system_test_clean_*` name, applies every
migration, checks for drift against `schema.prisma`, and drops only that exact
temporary database in a `finally` block.

Prove both backfill phases and reconciliation together with isolated AC and WM
fixtures:

```bash
ALLOW_TEST_BACKFILL_VERIFY=VERIFY_TEST_BACKFILL_END_TO_END \
npm run db:verify:backfill
```

This second guarded verifier creates a generated test database, migrates it from
zero, inserts one legacy order/Registration/scan fixture, runs Phase 3 and Phase
4 twice, requires identical second-run counts, requires a clean reconciliation
report, and then removes only its generated database.

Resolve reviewed quarantine rows using their exact IDs and a non-empty decision:

```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "resolution": "Mapped to the approved Product Model"
  }
]
```

```bash
ALLOW_TEST_QUARANTINE_RESOLUTION=RESOLVE_TEST_QUARANTINE \
QUARANTINE_RESOLUTIONS_FILE=/absolute/path/resolutions.json \
npm run db:quarantine:resolve
```

The resolver is test-database-only, rejects duplicate IDs and blank decisions,
is idempotent for an identical resolution, and refuses to overwrite a different
resolution already recorded for the row.

## Production additive migration wizard

Run the reviewed interactive wizard from `apps/backend` on the production
server:

```bash
./scripts/production-database-migration-wizard.sh
```

The wizard pins Prisma through `npm ci`, verifies the database identity, requires
writes to be stopped, creates and validates a backup, restores it into an
explicitly named test database, rehearses baselining and migration there, and
requires separate approval before recording the same verified baseline and
deploying the additive migration in production. It does not run production
backfill or destructive contract migrations.
