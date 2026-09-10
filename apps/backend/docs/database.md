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
