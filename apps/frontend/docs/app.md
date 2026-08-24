# Aplikasi AC System (Layer Aplikasi)

Halaman fungsional yang dibangun di atas VM3, terhubung ke backend `:3010`.

## Alur Autentikasi

```
Browser
  ├─ POST /login {username, password}        → { accessToken, refreshToken }
  ├─ accessToken  → di memory (lib/api.ts)
  ├─ refreshToken → localStorage (vm3-refresh-token)
  ├─ tiap request: Authorization: Bearer <accessToken>
  ├─ 401 → refresh otomatis (POST /login/refresh_token) → retry 1×
  └─ logout → clearTokens() → redirect /login
```

- `src/lib/api.ts` — fetch client: `http.get/post/put/del`, refresh otomatis saat 401, error terstruktur `ApiError`. URL via `NEXT_PUBLIC_API_URL` (default `http://localhost:3010`).
- `src/lib/auth.tsx` — `AuthProvider` + `useAuth()`: `login()`, `logout()`, `user`. Pulihkan sesi saat reload via refresh token.
- Proteksi: layout `(app)` redirect ke `/login` bila belum autentikasi.

## Halaman & Data

| Route | File | Endpoint backend |
|---|---|---|
| `/login` | `app/login/page.tsx` | `POST /login` |
| `/` (Dashboard UPH) | `app/(app)/page.tsx` | `GET /rdps/dashboard`, `GET /rdps/total-po-scan` |
| `/regist` | `app/(app)/regist/page.tsx` | `GET/POST/DELETE /registscan*` |
| `/scan` | `app/(app)/scan/page.tsx` | `GET /registscan`, `POST /rdps/post` (header `idregist`) |
| `/history` | `app/(app)/history/page.tsx` | `GET /rdps/history` (header `idregist`), `DELETE /rdps/delete/:id` |
| `/master` | `app/(app)/master/page.tsx` | CRUD `/model`, `/line`, `/bomlist`, `/users`, `/pin` |

### Dashboard
- Ringkasan kartu: total scan, model aktif, subline
- Grafik bar UPH per model (per jam, dari `uph[].record`)
- Tabel total scan per PO
- Pencarian line/subline → `GET /rdps/dashboard?keyword=`

### Regist
- Form registrasi batch (validasi backend: 6 field wajib + cocok BOM list)
- Tabel registrasi + hapus

### Scan
- Pilih registrasi aktif (Select)
- Form SN + material (Enter = scan cepat)
- Hasil scan: brand, model, PO, order, SN

### History
- Filter per registrasi + pencarian (debounce 300ms)
- Pagination (limit 20)

### Master (CRUD generik)
Satu kerangka tabel+dialog untuk 5 entitas — definisi field di `ENTITIES[]` (master/page.tsx). Tiap entitas: `getList/create/update/remove`.

## Arsitektur Halaman

```
app/
├── layout.tsx             # root: ThemeProvider + AuthProvider + SnackbarProvider + no-flash
├── login/page.tsx         # publik
└── (app)/                 # protected group
    ├── layout.tsx         # AppBar + rail (desktop) / navbar (mobile) + drawer
    └── page.tsx           # dashboard
```

> **PENTING**: `(app)/layout.tsx` hanya merender `{children}` SEKALI — nav desktop/mobile adalah chrome yang sama (jangan render children dobel, itu bikin field/ID ganda).

## Showcase

`/showcase/tokens`, `/showcase/motion`, `/showcase/components` — galeri semua token/komponen × varian × state (sumber acuan UI).

## Env Frontend

```env
NEXT_PUBLIC_API_URL=http://localhost:3010   # wajib bila backend bukan localhost:3010
```
