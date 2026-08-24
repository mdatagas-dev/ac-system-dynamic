# Testing Frontend — Playwright E2E

## Aturan Mutlak

1. **TIDAK pakai TDD untuk frontend** — aturan TDD hanya berlaku untuk backend (`apps/backend`).
2. **Frontend diuji dengan end-to-end (Playwright)**, dijalankan **setelah semua selesai** — bukan per-fitur.
3. Wajib hijau sebelum menyatakan selesai / merge.

## Isi Suite

File: `e2e/*.spec.ts`

| Spec | Cakupan |
|---|---|
| `auth.spec.ts` | render login, proteksi route, kredensial salah, login-benar → dashboard, logout |
| `scan.spec.ts` | alur scan penuh: regist via API → pilih regist → scan via UI → hasil tampil → cleanup |
| `crud.spec.ts` | master data Model: tambah → edit → hapus via UI |
| `ui.spec.ts` | tab order login, dialog muncul + Esc menutup, toggle tema light/dark, responsive bar/rail |

## Menjalankan

```bash
pnpm test:e2e
# atau dengan reporter detail
npx playwright test --reporter=list
```

## Infrastruktur

- `playwright.config.ts` — `webServer` otomatis menjalankan **backend** (`node ../backend/src/index.js`, :3010) + **frontend** (`next dev`, :3000). `reuseExistingServer: true`.
- `playwright/global-setup.ts` — seed user `e2e_test` di DB `ac_production` (via `execFileSync` agar hash bcrypt ber-`$` tidak di-expand shell).
- `playwright/global-teardown.ts` — hapus user + data dummy (`E2E-%`) setelah run.
- `e2e/helpers.ts` — helper `login(page)` (UI) dan `apiLogin(request)` (token untuk setup data).

## Aksesibilitas yang Diuji

- Tab order login (username → password → submit)
- Dialog: focus masuk, Esc menutup
- Focus visibility (via komponen FocusRing)

## Catatan Infrastruktur

- Backend harus berjalan untuk halaman aplikasi (dashboard/scan/master membaca API :3010).
- Port test: frontend `3000`, backend `3010`. Ganti bila bentrok.
- Seluruh test memakai data dummy berprefix `E2E-`/`e2e_` dan membersihkan setelah run — DB `ac_production` tidak meninggalkan residu (terverifikasi 0 baris).
