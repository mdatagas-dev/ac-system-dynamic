# Testing Backend — TDD Wajib

## Aturan Mutlak

- **Setiap fitur baru wajib TDD**: RED (tulis test gagal dulu) → GREEN (implement) → REFACTOR.
- **Bug fix wajib**: tulis test reproduksi (merah) → fix (hijau).
- Wajib hijau (`npm test` exit 0) sebelum selesai. Dilarang commit saat merah.
- **Dilarang test memakai DB produksi** — wajib DB test `ac_system_test`.

> Frontend (apps/frontend) TIDAK memakai TDD — diuji Playwright E2E di akhir. Aturan ini khusus backend.

## Menjalankan

```bash
npm test
# = node --test --test-force-exit test/api.test.js
```

Suite: `test/api.test.js` — 22 test integrasi (auth, users, model, line, pin, bomlist, uph, registscan, rdps). Helper: `test-helpers.js` (boot server in-process port 3199, request + JWT, registry cleanup).

## DB Test Terpisah

Setup sekali:

```bash
psql "postgresql://engineering@localhost:5433/postgres" -c "CREATE DATABASE ac_system_test"
psql "postgresql://engineering@localhost:5433/ac_system_test" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"
DATABASE_URL="postgresql://engineering@localhost:5433/ac_system_test?sslmode=disable" npx prisma db push --skip-generate
```

Mekanisme:
- `.env.test` → `DATABASE_URL` menunjuk `ac_system_test`
- `test-helpers.js` load `.env.test` (override) sebelum boot
- **Guard**: boot ditolak bila `DATABASE_URL` tidak mengandung `test`

Setiap perubahan schema → `prisma db push` ulang ke DB test.

## Pola Test

```js
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { api, track, waitForServer, cleanupAll } = require("../test-helpers");

before(waitForServer);
after(cleanupAll);

test("POST /model/post → 200, duplikat → 409", async () => {
  let r = await api("POST", "/model/post", { brand: "B", model: "M-X" });
  assert.strictEqual(r.status, 200);
  track("model", r.data.data?.id);   // auto cleanup
  r = await api("POST", "/model/post", { brand: "B", model: "M-X" });
  assert.strictEqual(r.status, 409);
});
```

## Aturan Test

1. Data dummy + `track()` — cleanup otomatis di `after()`. Jangan tinggalkan data.
2. Cakupan minimum per endpoint: sukses, validasi gagal (400), duplikat/konflik (409/400), error case utama.
3. Jangan skip test gagal tanpa alasan tercatat.
4. Terverifikasi: 22/22 pass, 0 residu di DB test.
