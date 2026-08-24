/**
 * VM3 Theme Engine — seed color → DynamicScheme (HCT, TONAL_SPOT) → semantic roles.
 * API modern material-color-utilities 0.4.0: DynamicScheme + MaterialDynamicColors.
 */
import {
  Hct,
  Variant,
  DynamicScheme,
  MaterialDynamicColors,
  hexFromArgb,
  argbFromHex,
  type DynamicColor,
} from "@material/material-color-utilities";
import { colorRoles, roleToVar, type ColorRole } from "./roles";

/** Seed brand default VM3 — SPACEX unified hitam (1 tema dengan login) */
export const DEFAULT_SEED = argbFromHex("#000000");

export type ThemeMode = "light" | "dark";

export type Palette = Record<ColorRole, string>;

const accessors = new MaterialDynamicColors() as unknown as Record<
  ColorRole,
  () => DynamicColor
>;

/** Seed (argb) + mode → semantic palette HEX (baseline M3: tonal spot) */
export function generatePalette(seed: number, mode: ThemeMode): Palette {
  const scheme = new DynamicScheme({
    sourceColorHct: Hct.fromInt(seed),
    variant: Variant.TONAL_SPOT,
    contrastLevel: 0,
    isDark: mode === "dark",
  });
  const palette = {} as Palette;
  for (const role of colorRoles) {
    palette[role] = hexFromArgb(accessors[role]().getArgb(scheme));
  }
  return palette;
}

/** Palette → string baris CSS variable "--vm3-color-x: #hex;" */
export function paletteToCssVars(palette: Palette): string {
  return colorRoles
    .map((role) => `  ${roleToVar(role)}: ${palette[role]};`)
    .join("\n");
}

/** Palette → Record CSS variable → nilai (untuk inline style runtime) */
export function paletteToVarRecord(palette: Palette): Record<string, string> {
  const record: Record<string, string> = {};
  for (const role of colorRoles) {
    record[roleToVar(role)] = palette[role];
  }
  return record;
}
