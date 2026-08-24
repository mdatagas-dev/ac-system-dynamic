# AC System — Pipeline Documentation

> **Versi:** 2.1 · **Update:** 23 Agustus 2026 · **Stack:** Turborepo + Next.js 16 + Express + Prisma + PostgreSQL + Redis

---

## Daftar Isi
1. [Ringkasan](#1-ringkasan)
2. [Arsitektur Monorepo](#2-arsitektur-monorepo)
3. [Pipeline Pengembangan (Dev)](#3-pipeline-pengembangan-dev)
4. [Pipeline Build (Turborepo)](#4-pipeline-build-turborepo)
5. [Pipeline Data Produksi](#5-pipeline-data-produksi--scan--uph)
6. [Pipeline Autentikasi](#6-pipeline-autentikasi)
7. [Pipeline UI/UX — Smooth & Responsive](#7-pipeline-uiux--smooth--responsive)
8. [Pipeline CI/CD (GitHub Actions)](#8-pipeline-cicd-github-actions)
9. [Pipeline Testing](#9-pipeline-testing)
10. [Pipeline Deployment](#10-pipeline-deployment)
11. [Matriks Lingkungan](#11-matriks-lingkungan)
12. [Troubleshooting](#12-troubleshooting)
13. [Lampiran](#lampiran)

---

## 1. Ringkasan

AC System adalah sistem monitoring produksi **Indoor AC (IDU)** — mengelola registrasi batch, scan unit per SN, perhitungan UPH (Unit Per Hour), dan master data (Model, Line, BOM, User, PIN).

| Aspek | Detail |
|---|---|
| **Monorepo** | `pnpm workspaces` + `turbo` |
| **Frontend** | `apps/frontend` — Next.js 16.3.2, React 19, Tailwind v4, Motion, Base UI, VM3 Design System |
| **Backend** | `apps/backend` — Express 5, Prisma 6, PostgreSQL, Redis, JWT |
| **Mock Mode** | `NEXT_PUBLIC_MOCK=1` → `src/lib/mock-api.ts` (tanpa DB, demo 168 unit) |
| **Package Manager** | `pnpm@11.22.0` |
| **Node** | `>=18` |

```
              ┌─────────────────────────────────────────┐
              │           Developer (pnpm)              │
              └────────────────┬────────────────────────┘
                               │ pnpm dev / build / test
              ┌────────────────▼────────────────────────┐
              │           Turborepo Pipeline            │
              │  turbo dev  ·  turbo build  ·  turbo test │
              └──────┬──────────────────────────┬───────┘
                     │                          │
         ┌───────────▼───────────┐  ┌───────────▼───────────┐
         │  apps/frontend        │  │  apps/backend         │
         │  Next.js 16 + VM3     │  │  Express + Prisma     │
         │  Port 3000            │  │  Port 3010            │
         └───────────┬───────────┘  └───────────┬───────────┘
                     │                          │
                     └───────────┬──────────────┘
                                 ▼
                     ┌─────────────────────┐
                     │  PostgreSQL + Redis │
                     │  ac_production      │
                     └─────────────────────┘
```

---

## 2. Arsitektur Monorepo

```
ac-system/
├── package.json              # root: turbo dev/build/test
├── pnpm-workspace.yaml       # workspaces: apps/*
├── turbo.json                # pipeline cache & deps
├── docs/
│   └── PIPELINE.md           # ← dokumen ini
└── apps/
    ├── frontend/             # Next.js App Router
    │   ├── src/
    │   │   ├── app/
    │   │   │   ├── (app)/           # Shell AppBar + Rail + Drawer (protected)
    │   │   │   │   ├── page.tsx          # Dashboard UPH
    │   │   │   │   ├── regist/page.tsx   # Registrasi Batch
    │   │   │   │   ├── scan/page.tsx     # Scan Unit
    │   │   │   │   ├── history/page.tsx  # Riwayat + Hapus (Dialog)
    │   │   │   │   └── master/page.tsx   # CRUD 5 entitas (Dialog)
    │   │   │   ├── login/
    │   │   │   │   ├── page.tsx          # Route login
    │   │   │   │   └── LoginForm.tsx     # Form + header AC SYSTEM (logo dihapus)
    │   │   │   └── layout.tsx            # Root + ThemeProvider + AuthProvider
    │   │   ├── components/vm3/      # Button, Dialog, Navigation, Card, dll
    │   │   ├── design-system/
    │   │   │   ├── tokens/          # core.css, component.css, overlays.css, navigation.css
    │   │   │   ├── themes/          # default.css, palette, ThemeProvider
    │   │   │   └── motion/          # presets.ts, tokens.ts
    │   │   └── lib/
    │   │       ├── api.ts           # http client + refresh auto 401
    │   │       ├── auth.tsx         # decodeUser JWT + Context
    │   │       ├── mock-api.ts      # interceptor mock
    │   │       └── mock-data.ts     # dataset cerita AN05CDG (168 unit)
    │   ├── public/spacex/media/     # video 1.webp, logos (logo dihapus dari UI)
    │   ├── playwright/              # e2e config
    │   └── e2e/                     # auth.spec, crud.spec, ui.spec
    └── backend/              # Express API
        ├── src/
        │   ├── index.js             # app + CORS + routes + error handler
        │   ├── config/redis.js      # Redis client (REDIS_URL wajib)
        │   └── routes/
        │       ├── login.js         # POST /login, POST /login/refresh_token
        │       ├── rdps.js          # /rdps/dashboard, /post, /history, /delete
        │       ├── rgscan.js        # /registscan /* CRUD batch
        │       ├── model.js, line.js, bomlist.js, users.js, pin.js, uph.js
        │   └── middlewares/
        │       ├── auth.js          # Bearer JWT verify
        │       └── logger.js
        ├── prisma/
        │   └── schema.prisma        # 8 model: User, Model, Line, BomList, RegistScan, Rdps, Suph, Pin
        └── test/api.test.js         # node:test
```

Turbo memetakan task `build` dengan `dependsOn: ["^build"]` — backend build dulu baru frontend jika ada dependensi paket bersama.

---

## 3. Pipeline Pengembangan (Dev)

### 3.1 Prasyarat
- Node 18+, pnpm 11+, PostgreSQL 14+, Redis 7+, Git

### 3.2 Mode Mock (tanpa DB) — Default Dev
```bash
git clone <repo> && cd ac-system
pnpm install

# aktifkan mock (sudah default di apps/frontend/.env.example)
echo "NEXT_PUBLIC_MOCK=1" > apps/frontend/.env

# jalankan
pnpm dev          # turbo dev → frontend http://localhost:3000
# atau spesifik:
pnpm --filter frontend dev
```
Mock menyediakan login palsu, 3 batch registrasi (`rg-001/002/003`), 168 unit hourly, validasi double-scan.

### 3.3 Mode Full-Stack (DB nyata)
```bash
# 1. Backend env
cat > apps/backend/.env <<'ENV'
PORT=3010
DATABASE_URL="postgresql://engineering@localhost:5433/ac_production?sslmode=disable"
JWT_SECRET="ganti-ini-access"
JWT_REFRESH="ganti-ini-refresh"
REDIS_URL="redis://:PASSWORD@127.0.0.1:6379"
ENV

# 2. Migrasi & generate client
cd apps/backend
npx prisma migrate deploy
npx prisma generate

# 3. Jalankan dua terminal
pnpm dev   # root: turbo dev → backend 3010 + frontend 3000 paralel
# atau manual:
# terminal 1: pnpm --filter backend dev   # nodemon src/index.js
# terminal 2: pnpm --filter frontend dev  # next dev
```

### 3.4 Hot Reload & Cache
| Pipeline | Watch | Cache |
|---|---|---|
| `turbo dev` | `persistent: true`, `cache: false` | Tidak dicache (selalu fresh) |
| `turbo build` | Sekali | Dicache di `.turbo/` + `node_modules/.cache` |

---

## 4. Pipeline Build (Turborepo)

```jsonc
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true },
    "start": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

**Alur `pnpm build` (root):**
```
1. pnpm install (workspaces)
2. turbo build
   ├─ apps/backend:  (tidak ada build step spesifik, hanya validasi)
   └─ apps/frontend: next build (Turbopack)
        ├─ Compiled successfully ~800ms
        ├─ TypeScript check ~4s
        ├─ Collect page data (13 routes)
        └─ Static generation → .next/
```

**Perintah cepat:**
```bash
pnpm build          # semua apps
pnpm --filter frontend build   # hanya frontend
pnpm --filter frontend lint    # eslint (0 error target)
pnpm --filter frontend typecheck  # npx tsc --noEmit
```

> **Catatan 23 Agustus 2026:** Navigasi sidebar dipercepat ke `200ms short4`, Dialog/BottomSheet/Drawer dipindah ke CSS murni (bukan Motion JS) agar build tidak tambah bundle.

---

## 5. Pipeline Data Produksi — Scan → UPH

Pipeline inti bisnis: **Registrasi → Scan → Validasi → UPH Aggregation → Dashboard**

```
 ┌──────────────┐
 │  Master Data │  Model, Line, BOM, User, PIN (CRUD /master)
 └──────┬───────┘
        │
 ┌──────▼───────┐   POST /registscan/post
 │  Registrasi  │ ─────────────────────►  RegistScan (plan, subline, shift)
 │  Batch       │   {model, order_number, po_number, subline, plan}
 └──────┬───────┘
        │ header: idregist
 ┌──────▼───────┐   POST /rdps/post  {sn, sn_motor, sn_box, pcb_idu, ...}
 │  Scan Unit   │ ─────────────────────►  Rdps + Validasi
 │  /scan       │                         ├─ cek double SN → 409
 └──────┬───────┘                         ├─ cek BOM 5-char split
        │                                 └─ simpan + invalidate Redis
        │
 ┌──────▼────────┐  GET /rdps/dashboard?keyword=AN05CDG
 │  Dashboard    │ ◄──────────────────────  Agregasi UPH per jam
 │  UPH Chart    │   {data:[{model, suph, total, uph:[{time,record}]}]}
 └──────┬────────┘
        │
 ┌──────▼────────┐  GET /rdps/history?idregist=rg-001&page=1&keyword=SN
 │  Riwayat      │ ◄──────────────────────  Paginated + Search + Delete (Dialog)
 │  /history     │
 └───────────────┘
```

**Validasi Scan (backend `rdps.js`):**
1. `idregist` wajib di header
2. SN tidak boleh duplikat di registrasi yang sama
3. Model 5 karakter terakhir dipisah cocok dengan BOM
4. Hitung UPH: `SUM(Rdps where registId)` per jam (07:00–15:00)

**Dataset Mock (cerita):**
```ts
// mock-data.ts
MODEL="AN05CDG"  BRAND="SHARP"  PO="PO-2608001"  SUPH="20"
SUBLINE: ASSY (96 unit, 17-19-20-21-19) | TESTING (60) | PACKING (12) → total 168
SN: AN05CDG-03XX, MTR-XXXX, PCB-IDU-XXXXX, CTN-CXXXX
```

---

## 6. Pipeline Autentikasi

```
 Login Form                 Auth Context                 API Client
 (username/password) ──►  POST /login  ──►  JWT access(20m) + refresh(7d)
                              │                    │
                              ▼                    ▼
                         decodeUser()        localStorage
                         {id, username,     accessToken
                          roleuser,         refreshToken
                          depart}
                              │
                     ┌────────▼────────┐
                     │  Middleware auth│  Header: Authorization: Bearer <token>
                     │  semua route    │  401 → auto POST /login/refresh_token
                     │  kecuali /login│  gagal → logout → /login
                     └─────────────────┘
```

**Logout Pipeline (baru 23 Aug 2026):**

```
IconButton logout (AppBar)
   │ klik
   ▼
Dialog "Keluar dari AC System?"  (CSS 190ms in / 140ms out, esc bisa, focus trap)
   ├─ Batal → close
   └─ Keluar → clearTokens() + router.replace("/login")
```

Dulu logout langsung tanpa konfirmasi; sekarang wajib konfirmasi smooth untuk mencegah misclick.

---

## 7. Pipeline UI/UX — Smooth & Responsive

Perubahan Agustus 2026 untuk mengatasi *delay perpindahan page* dan *popup patah*:

| Komponen | Sebelum | Sesudah | Teknik |
|---|---|---|---|
| **Rail** | `width 400ms medium4` | `200ms short4 + will-change` | CSS compositor only |
| **Drawer** | `400ms / 300ms` | `220ms / 160ms` | `transform translateX` + `allow-discrete` |
| **Dialog hapus** | Motion JS `scale` tanpa `exit` → hilang patah | CSS `scale(0.96→1)` 200ms in / 150ms out | `data-open/data-ending-style` |
| **BottomSheet** | Motion slideUp tanpa exit | CSS `translateY 16px` 200ms | sama |
| **Scrim** | `300ms` | `200ms` | `opacity` only |
| **Perpindahan page** | Link default (block) | `startTransition` + `prefetch` + progress bar 2px + `motion.main` popLayout 180ms | `useTransition`, `router.prefetch`, `AnimatePresence` |

**PPD (Perceived Performance Design):**
- Prefetch semua `NAV` (`/`, `/regist`, `/scan`, `/history`, `/master`) saat idle → navigasi <50ms
- Progress bar tipis `scaleX` instant feedback saat `isPending`
- Hormati `prefers-reduced-motion` (`globals.css` → `transition-duration: 0.01ms`)
- Hormati `Ctrl/Cmd+klik` untuk buka tab baru

**Logo:** SpaceX `spacex-logo.png` dihapus dari `LoginForm.tsx`; header kini tipografi `AC SYSTEM tracking-[0.32em]` (bebas lisensi).

---

## 8. Pipeline CI/CD (GitHub Actions)

> Repo belum punya `.github/workflows/` — template siap pakai di bawah mengikuti praktik `ci-cd` skill.

**File yang direkomendasikan:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter frontend lint

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: next-build
          path: apps/frontend/.next

  test:
    name: E2E
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:14
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: ac_test }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps
      - run: pnpm --filter backend test
      - run: pnpm --filter frontend test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ac_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: ci-secret
          JWT_REFRESH: ci-refresh

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - run: echo "Vercel preview deploy via vercel/actions/deploy@v2 — hubungkan project Vercel"

  deploy-production:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploy ke VPS: scp + pm2 restart — pakai secrets HOST/SSH_KEY"
```

**Ringkasan pipeline:**
```
push/PR → lint (fail-fast) → build (artifact .next) → test (postgres+redis service → backend unit + frontend e2e)
          ├─ PR → deploy-preview (Vercel)
          └─ main push → deploy-production (VPS)
```

**Optimasi:**
- `cache: pnpm` (setup-node otomatis cache dari `pnpm-lock.yaml`)
- `concurrency.cancel-in-progress` hemat menit CI
- `needs: [lint]` fail cepat sebelum build mahal

**Lokal test pipeline:**
```bash
# act (opsional)
act -l
act -j lint
act -j build
```

---

## 9. Pipeline Testing

| Layer | Perintah | Cakupan |
|---|---|---|
| **Backend unit** | `pnpm --filter backend test` → `node --test test/api.test.js` | Auth, CRUD model/line/bom, scan validasi |
| **Frontend E2E** | `pnpm --filter frontend test:e2e` | Playwright — `e2e/auth.spec.ts`, `crud.spec.ts`, `ui.spec.ts` |
| **Visual** | `pnpm --filter frontend build && npx tsc --noEmit` | Type safety |

**Flow E2E (Playwright):**
```
global-setup.ts  → seed user e2e_test + 3 registrasi
  ├─ auth.spec.ts      → login form, proteksi route, kredensial salah, login→dashboard→logout (dengan Dialog konfirmasi)
  ├─ ui.spec.ts        → tab order, dialog Esc, toggle tema, responsive rail vs navbar
  └─ crud.spec.ts      → master model: tambah → edit → hapus (Dialog hapus smooth)
global-teardown.ts → hapus seed
```

**Manual verify mock:**
```bash
node verify-mock.tmp.mjs # cek 168/1/3, double-reject, pagination
```

---

## 10. Pipeline Deployment

### Opsi A — Next.js Standalone (Docker)
```dockerfile
# apps/frontend/Dockerfile
FROM node:20-alpine AS base
RUN npm i -g pnpm
FROM base AS deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
FROM base AS builder
COPY . .
RUN pnpm --filter frontend build
FROM base AS runner
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
```

### Opsi B — Vercel
```json
// vercel.json
{ "framework": "nextjs", "buildCommand": "pnpm build", "installCommand": "pnpm install" }
```
Set env di Vercel: `NEXT_PUBLIC_MOCK=0` (prod) + `DATABASE_URL`, `REDIS_URL` di backend terpisah.

### Backend — PM2
```bash
# apps/backend/ecosystem.config.js
module.exports = { apps: [{ name: "ac-backend", script: "src/index.js", env: { PORT: 3010 } }] }
pm2 start ecosystem.config.js --env production
pm2 logs ac-backend
```

**Urutan deploy aman:**
1. `pnpm build` lolos di CI
2. `grep NEXT_PUBLIC_MOCK .env || echo "✅ Mock disabled untuk prod"`
3. `npx prisma migrate deploy` (jangan `migrate dev` di prod)
4. Deploy backend dahulu, health-check `GET /health` (jika ada)
5. Deploy frontend, purge CDN jika pakai Vercel/CloudFront

---

## 11. Matriks Lingkungan

| Variabel | Frontend (`.env`) | Backend (`.env`) | Wajib | Contoh |
|---|---|---|---|---|
| `NEXT_PUBLIC_MOCK` | ✅ | — | Dev only | `1` → mock, `0`/hapus → real API |
| `NEXT_PUBLIC_API_URL` | ✅ | — | Prod | `https://api.ac-system.internal` |
| `PORT` | — | ✅ | Ya | `3010` |
| `DATABASE_URL` | — | ✅ | Ya | `postgresql://.../ac_production` |
| `REDIS_URL` | — | ✅ | Ya | `redis://:pass@127.0.0.1:6379` |
| `JWT_SECRET` | — | ✅ | Ya | `random-64chars` |
| `JWT_REFRESH` | — | ✅ | Ya | `random-64chars` |

**Aturan:**
- Jangan commit `.env` — pakai `.env.example`
- `REDIS_URL` wajib, tanpa fallback (keamanan)
- Ganti `JWT_SECRET` tiap rotasi, invalidate semua refresh token

---

## 12. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Login gagal setelah ganti `NEXT_PUBLIC_MOCK` | Dev server cache env | `pkill -f "next dev"; pnpm dev` |
| Dashboard total 0 | `seed_records` timestamps bukan hari ini | `curl localhost:3010/rdps/dashboard?keyword=AN05CDG` — cek DB `Rdps.timestamps` |
| Double scan tidak tertolak | Logic duplikat hilang / localStorage stale | Cek `mock-api.ts`/`rdps.js` duplicate check, clear `localStorage` |
| Ikon tidak center / 24px terkunci | Import `material-symbols` unlayered override Tailwind | Sudah fix: `@import ".../rounded.css" layer(icons)` di `globals.css` |
| Dialog tidak smooth | Motion wrapper tanpa exit | Sudah fix: CSS `data-ending-style` 150ms |
| Navigasi delay | Chunk belum prefetch | Pastikan `router.prefetch` di `layout.tsx` dan `pnpm build` sukses |
| `REDIS_URL` error saat start backend | Env hilang | Set `REDIS_URL` di `.env` dan export di PM2 |

---

## Lampiran

### Perintah Cepat

```bash
# dev semua
pnpm dev

# hanya frontend (mock)
pnpm --filter frontend dev

# hanya backend
pnpm --filter backend dev   # atau npm run dev di apps/backend

# build & cek
pnpm build
pnpm --filter frontend lint
pnpm --filter frontend test:e2e
pnpm --filter backend test

# DB
cd apps/backend
npx prisma studio          # GUI DB
npx prisma migrate dev --name tambah_kolom
npx prisma generate
```

### Kontak Pipeline
- **DevOps:** Setup infra, Redis/Postgres, PM2/Docker, GitHub Actions secrets
- **Engineering:** Fitur & bugfix (perpindahan page, Dialog, mock-api)
- **Product:** Menentukan skenario mock (plan, SUPH, jam kerja)

---
*Dokumen ini adalah sumber kebenaran pipeline. Update saat menambah route, env baru, atau mengubah strategi deploy. Simpan perubahan di `docs/PIPELINE.md` dan sebut di PR description.*
