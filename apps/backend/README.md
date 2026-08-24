# Backend AC System

API backend untuk sistem scan produksi AC. Express + Prisma + PostgreSQL + Redis.

## Stack

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js, Express 5 |
| ORM | Prisma 6 (`prisma/schema.prisma`) |
| Database | PostgreSQL (`ac_production`) |
| Cache | Redis (dashboard, 60s) |
| Auth | JWT (access 20m + refresh 7d) |
| Password | bcrypt (hanya `hash` disimpan — kolom `password` sudah dihapus) |

## Struktur

```
apps/backend/
├── src/
│   ├── index.js          # entry, CORS, routing, error handler
│   ├── config/redis.js   # client Redis (REDIS_URL wajib)
│   └── routes/
│       ├── login.js      # POST /login, /refresh_token
│       ├── rgscan.js     # /registscan (CRUD registrasi batch)
│       ├── rdps.js       # /rdps (scan, dashboard, history, export)
│       ├── users.js      # /users (CRUD user)
│       ├── model.js      # /model (CRUD)
│       ├── line.js       # /line (CRUD)
│       ├── pin.js        # /pin (PIN harian)
│       ├── bomlist.js    # /bomlist (CRUD)
│       └── uph.js        # /uph (CRUD)
├── lib/prisma.js         # singleton PrismaClient
├── middlewares/
│   ├── auth.js           # verifikasi Bearer JWT
│   └── logger.js         # log request
├── prisma/schema.prisma
└── test/                 # suite node:test (TDD)
```

## Menjalankan

```bash
# install + generate client
npm install
npx prisma generate

# dev / produksi (butuh .env, lihat di bawah)
npm run dev        # nodemon
npm start

# test (wajib TDD — lihat docs/testing.md)
npm test
```

## Environment (`.env`)

```env
PORT=3010
DATABASE_URL="postgresql://engineering@localhost:5433/ac_production?sslmode=disable"
JWT_SECRET="<rahasia-access>"
JWT_REFRESH="<rahasia-refresh>"
REDIS_URL="redis://:PASSWORD@127.0.0.1:6379"
```

`REDIS_URL` **wajib** — server menolak start tanpa itu (keamanan: tidak ada password default lagi).

## Autentikasi

Semua route kecuali `/login` dipasang middleware `auth`:

- Header: `Authorization: Bearer <accessToken>`
- 401 bila token hilang / tidak valid / kedaluwarsa
- Refresh: `POST /login/refresh_token` dengan `refreshToken` dari body
- Endpoint tertentu memakai header tambahan:
  - `idregist` — `/rdps/scan`, `/rdps/history`
  - `iduser` — `/registscan/checkregist`

## Alur Scan (bisnis inti)

```
Registrasi batch (registscan) dibuat → cocokkan BOM list (model & order_number)
    ↓
Operator scan SN di line (rdps/post)
    ↓ Validasi dalam transaksi:
    ├── SN tidak boleh karakter tidak valid
    ├── FOR UPDATE lock baris recordscan (anti race)
    ├── Cek double scan per subline
    ├── Jika subline = "PACKING OUTPUT":
    │   └── cek unit terlewat di line sebelumnya (missed scan)
    └── Cek akurasi scan vs data registrasi (harus > 5%)
    ↓
recordscan dibuat → dashboard/history terupdate
```

Detail endpoint: [docs/api.md](docs/api.md) · Model data: [docs/database.md](docs/database.md) · Testing: [docs/testing.md](docs/testing.md)
