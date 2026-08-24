# Aturan Pengembangan (TDD Wajib)

> **Frontend (apps/frontend) TIDAK memakai TDD** — diuji dengan Playwright E2E setelah selesai. Lihat `apps/frontend/docs/testing.md`. Aturan di bawah berlaku untuk backend.

## 1. Fitur tambahan wajib TDD
Setiap fitur baru wajib mengikuti siklus Test-Driven Development:

1. **RED** — tulis test dulu di `test/api.test.js` (atau file test baru di `test/`)
   - Test harus menggambarkan perilaku yang diharapkan
   - Jalankan, pastikan test GAGAL (karena fitur belum ada)
2. **GREEN** — implementasi fitur
   - Jalankan test, pastikan HIJAU
3. **REFACTOR** — rapikan jika perlu, test tetap hijau

## 2. Aturan test
- Semua test harus pakai **data dummy + cleanup** — jangan pernah tinggalkan data di DB
- Gunakan helper `track()` untuk mendaftar data yang dibuat, cleanup otomatis di `after()`
- Cakupan minimum per endpoint baru:
  - sukses (status benar)
  - validasi gagal (field wajib kosong → 400)
  - duplikat/konflik jika ada (409/400)
  - error case utama

## 3. Wajib hijau sebelum selesai
- Jalankan `npm test` sebelum menyatakan tugas selesai
- Semua test harus pass (exit 0), tidak boleh ada yang merah
- Bug fix juga wajib: tulis test yang mereproduksi bug (merah) → fix (hijau)

## 4. Larangan
- Dilarang menambah fitur tanpa test
- Dilarang skip/menghapus test yang gagal tanpa alasan tercatat
- Dilarang commit saat test merah
- **Dilarang keras test memakai DB produksi** — wajib DB test terpisah (lihat di bawah)

## 5. DB khusus test (wajib)
Test TIDAK boleh menyentuh `ac_production`. Ada DB khusus test: `ac_system_test`.

Setup DB test (sekali saja):
```bash
psql "postgresql://engineering@localhost:5433/postgres" -c "CREATE DATABASE ac_system_test"
psql "postgresql://engineering@localhost:5433/ac_system_test" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"
DATABASE_URL="postgresql://engineering@localhost:5433/ac_system_test?sslmode=disable" npx prisma db push --skip-generate
```

Mekanisme:
- `.env.test` berisi `DATABASE_URL` yang menunjuk `ac_system_test`
- `test-helpers.js` load `.env.test` (override) sebelum boot server
- Ada guard: boot ditolak jika `DATABASE_URL` tidak mengandung `test`

Kalau schema berubah, jalankan ulang `prisma db push` ke DB test sebelum `npm test`.

## Cara menjalankan
```bash
npm test
```
