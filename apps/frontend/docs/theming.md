# Theming & Design Tokens

VM3 menggunakan hierarki token tiga lapis: **Core → Semantic → Component**.

## Alur Theme Engine

```
Seed Color (default #0B57D0)
    ↓ HCT (Material Color Utilities)
Tonal Palette (DynamicScheme, varian TONAL_SPOT — baseline M3)
    ↓
Semantic Roles (35 role: primary, onPrimary, surfaceContainer*, dst)
    ↓
Theme Tokens (--vm3-color-* di :root / [data-theme="dark"])
    ↓
Component Tokens (--vm3-comp-*, --vm3-btn-*, dst)
    ↓
Rendered UI
```

## Hierarki Tokens

### 1. Core Tokens — nilai mentah
`src/design-system/tokens/core.ts` + `core.css`

- Spacing (grid 4px: `--vm3-space-*`)
- Type scale M3 15 gaya (`--vm3-font-*`)
- Shape (`--vm3-shape-none..full` = 0/4/8/12/16/28/9999)
- Elevation level 0-5 (`--vm3-elevation-{n}-shadow`)
- State opacity (`--vm3-state-hover/focus/pressed/dragged`)
- Z-index, breakpoints (M3 window classes: compact/medium/expanded/large/extra-large)
- Motion (`--vm3-duration-*`, `--vm3-easing-*`)

### 2. Semantic Tokens — makna
`src/design-system/themes/roles.ts` + `default.css` (GENERATED)

35 color roles M3:
`primary, onPrimary, primaryContainer, onPrimaryContainer, secondary*, tertiary*, error*, surfaceDim, surface, surfaceBright, surfaceContainerLowest/Low/Container/High/Highest, onSurface, surfaceVariant, onSurfaceVariant, outline, outlineVariant, inverseSurface, inverseOnSurface, inversePrimary, shadow, scrim, surfaceTint`

Dihasilkan dari seed via `generatePalette(seed, mode)` di `palette.ts`.

### 3. Component Tokens — per komponen
`src/design-system/tokens/component.css` (+ buttons.css, fields.css, dst)

Contoh: `--vm3-comp-button-height`, `--vm3-comp-fab-size`, `--vm3-comp-navbar-height`, `--vm3-comp-touch-target` (48px).

## Mengganti Warna Brand (Seed)

Ubah seed di **satu tempat**: `DEFAULT_SEED` di `src/design-system/themes/palette.ts` (hex `#0B57D0`), lalu:

```bash
# regenerate default.css (tema statis light + dark)
pnpm theme:gen
```

Seed juga bisa diganti runtime lewat `useTheme().setSeed("#hex")` — ThemeProvider menghitung palette HCT di browser dan meng-inline CSS vars.

## Dark Mode

- `[data-theme="dark"]` pada `<html>` mengaktifkan variabel tema gelap.
- Toggle: `useTheme().toggleMode()`.
- Persisted di localStorage (`vm3-theme`, `vm3-seed`).
- No-flash: inline script di `layout.tsx` menetapkan tema sebelum hidrasi.

## Integrasi Tailwind

`src/design-system/themes/tailwind.css` memetakan token ke `@theme`:
- `--color-primary` → utilitas `bg-primary`, `text-on-surface`, dst
- `--radius-*` → `rounded-*`
- `--shadow-1..5` → `shadow-1..5`
- `--ease-*` → easing utilities

> **PENTING**: jangan override `--spacing-*` Tailwind — merusak skala `w-*`/`p-*`/`m-*`. Token spacing VM3 tetap via `--vm3-space-*`.

## Menambah Token Baru

1. Tambah nilai mentah di `core.ts` + `core.css` (atau file token sesuai kategori)
2. Tambah semantic role di `roles.ts` (bila warna) → regenerate `default.css`
3. Konsumsi di komponen via CSS var — jangan hardcode nilai
