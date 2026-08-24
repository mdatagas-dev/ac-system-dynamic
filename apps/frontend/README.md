# Virtual Material 3 (VM3)

Design system frontend custom — **Material Design 3** sebagai fondasi, lapisan **spatial depth** sebagai penguat, **motion** menjelaskan interaksi, **tokens** menjaga konsistensi.

Dibangun dari nol. **Tanpa MUI, tanpa shadcn/ui.**

## Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Bahasa | TypeScript (strict) |
| Styling | Tailwind CSS v4 + CSS Variables (design tokens) |
| Headless primitives | Base UI (aksesibilitas, keyboard, focus, dialog/menu/popover/tooltip/select) |
| Animasi | Motion (`motion/react`) — enter/exit/layout, reduced-motion aware |
| Ikon | Material Symbols (variable font) |
| Virtualisasi | TanStack Virtual |
| Warna M3 | `@material/material-color-utilities` (HCT, DynamicScheme, tonal spot) |
| E2E | Playwright |

## Arsitektur

```
Application (pages AC system)
    ↓
VM3 Components (src/components/vm3)
    ↓
Virtual Spatial Layer (src/design-system/spatial)
    ↓
Material Motion System (src/design-system/motion)
    ↓
Component Tokens (design-system/tokens/*.css)
    ↓
Semantic Design Tokens (--vm3-color-*)
    ↓
Core Design Tokens (core.ts + core.css)
    ↓
Base UI Primitives (components/primitives)
    ↓
React + Next.js
```

```
src/
├── app/                    # pages (login, dashboard, regist, scan, history, master, showcase)
├── components/
│   ├── vm3/                # komponen VM3 (Button, Dialog, Navigation, dll)
│   └── primitives/         # StateLayer, FocusRing
├── design-system/
│   ├── tokens/             # core.css, component.css, buttons.css, fields.css, dst
│   ├── themes/             # roles.ts, palette.ts, ThemeProvider, default.css (generated)
│   ├── motion/             # tokens.ts, presets.ts
│   ├── spatial/            # depth.ts, Surface.tsx
│   └── utilities/          # cn.ts
├── hooks/                  # useVm3ReducedMotion
├── lib/                    # api.ts (fetch client + auth refresh), auth.tsx
└── styles/
```

## Cara Menjalankan

```bash
# frontend (port 3000)
pnpm dev

# backend AC (port 3010) — dibutuhkan untuk halaman aplikasi
cd ../backend && node src/index.js

# build produksi
pnpm build

# typecheck
npx tsc --noEmit

# lint
pnpm lint

# E2E (Playwright) — lihat docs/testing.md
pnpm test:e2e
```

Halaman:

| Route | Isi |
|---|---|
| `/` | Dashboard UPH |
| `/regist` | Registrasi batch |
| `/scan` | Scan unit |
| `/history` | Riwayat scan |
| `/master` | Master data (Model/Line/BOM/Users/PIN) |
| `/login` | Login |
| `/showcase/tokens` | Showcase token (warna/tipografi/shape/elevasi/spasi) |
| `/showcase/motion` | Showcase motion + spatial |
| `/showcase/components` | Showcase semua komponen × varian × state |

## Aturan Inti

1. **Semua nilai visual dari token** — dilarang hardcode `border-radius: 12px`, `box-shadow: ...`, warna hex langsung di komponen. Komponen memakai token semantik (`--vm3-color-*`, `--vm3-shape-*`, `--vm3-elevation-*`, `--vm3-space-*`).
2. **Komponen hanya konsumsi semantic tokens**, bukan warna mentah (`#2196F3`).
3. **State layer M3** untuk interaksi (hover 8%, focus 12%, pressed 12%) — bukan hover acak.
4. **Motion menjawab**: dari mana? ke mana? apa yang berubah? Hormati `prefers-reduced-motion`.
5. **Accessibility built-in** — Base UI menangani keyboard/focus/ARIA; VM3 menangani visual.

## Dokumentasi Lanjutan

- [Aplikasi AC System](docs/app.md) — halaman, auth, data layer, kontrak API
- [Theming & Tokens](docs/theming.md) — seed color, palette, hierarki token
- [Komponen](docs/components.md) — katalog komponen
- [Testing E2E](docs/testing.md) — aturan mutlak Playwright
