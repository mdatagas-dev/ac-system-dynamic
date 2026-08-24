# Katalog Komponen VM3

Semua komponen di `src/components/vm3/`. Setiap komponen: **structure, tokens, variants, states, accessibility, motion, spatial behavior**.

## Actions

| Komponen | File | Varian | Catatan |
|---|---|---|---|
| Button | `Button.tsx` | `elevated / filled / tonal / outlined / text` | State layer currentColor, elevasi hover (elevated), loading spinner, icon, fullWidth |
| IconButton | `IconButton.tsx` | `standard / outlined / filled / tonal` | Wajib prop `label` (a11y) |
| Fab | `Fab.tsx` | regular / small / extended (label) | Elevasi 3 → 4 saat hover |
| SegmentedButton | `SegmentedButton.tsx` | single / multiple | role radiogroup/checkbox, indicator secondary-container + check |

## Inputs

| Komponen | Varian | Catatan |
|---|---|---|
| TextField | `filled / outlined` | Label melayang, helper/error, ikon leading, endSlot, disabled |
| TextArea | `filled / outlined` | resize vertical |
| SearchField | `filled / outlined` | Ikon search + tombol clear |
| Select | — | Base UI Select, popup motion |
| Combobox | — | Base UI Autocomplete, filter client |
| DatePicker | — | Kalender M3 dalam Popover, navigasi bulan, min/max, hari ini |

## Selection

| Komponen | Catatan |
|---|---|
| Checkbox | Native input + styling M3, `:has(input:checked)` |
| Radio | Group via `name` |
| Switch | Track 52×32, thumb, state layer |
| Slider | `accent-color` primary |

## Containment

| Komponen | Varian |
|---|---|
| Card | `elevated / filled / outlined` (+ interactive) |
| List / ListItem | leading icon, title, supporting, trailing, interactive |
| Divider | normal / inset |
| Chip | `assist / filter / input / suggestion` |
| Badge | count / dot |

## Overlays (Base UI + Motion)

| Komponen | Catatan |
|---|---|
| Dialog | Focus trap, esc, aria dari Base UI; enter scale |
| BottomSheet | Menempel bawah, slideUp |
| Menu | trigger + items API |
| Popover / Tooltip | Positioner floating |
| Snackbar | Provider + `useSnackbar()`, aria-live, auto-dismiss 4s |

## Navigation

| Komponen | Catatan |
|---|---|
| AppBar | leading, title, actions |
| NavigationBar | Mobile (bawah), indicator pill |
| NavigationRail | Desktop (samping), indikator bar |
| NavigationDrawer | Slide dari kiri, scrim |
| Tabs | Primary, indicator bawah |

## Feedback

| Komponen | Catatan |
|---|---|
| LinearProgress | determinate + indeterminate |
| CircularProgress | determinate + indeterminate |
| LoadingIndicator | Circular + teks |

## Data

| Komponen | Catatan |
|---|---|
| VirtualList | TanStack Virtual — list besar (log, history, activity) |

## Primitives

| Komponen | Catatan |
|---|---|
| StateLayer | Overlay interaksi M3 (hover/focus/pressed), `currentColor` |
| FocusRing | Indikator fokus keyboard (inset ring, `:focus-visible`) |

## Pola Penggunaan

```tsx
import { Button } from "@/components/vm3/Button";
import { Dialog } from "@/components/vm3/Dialog";

<Button variant="filled" icon="add" onClick={() => setOpen(true)}>
  Tambah
</Button>

<Dialog open={open} onOpenChange={setOpen} title="Konfirmasi" actions={<Button>OK</Button>}>
  ...
</Dialog>
```

## Rules

- **Interaktif** = tambah class `vm3-interactive` + `<StateLayer />` + `<FocusRing />`
- **States wajib**: default, hover, focus, pressed, selected, disabled, loading
- **Tanpa nilai hardcode** — pakai token (`--vm3-*`)
- Semua ikon: class `material-symbols-rounded` (font diimpor di `layout.tsx`)
