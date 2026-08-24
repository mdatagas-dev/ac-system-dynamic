/**
 * VM3 Core Tokens — nilai mentah (raw values).
 * Satu-satunya tempat nilai visual "primitif" hidup.
 * Komponen TIDAK boleh hardcode nilai visual — harus lewat token.
 */

export const spacing = {
  /** grid 4px */
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
  "4xl": "64px",
  /** grid halus 2px untuk detail */
  "2xs": "2px",
  "6xl": "96px",
} as const;

export const shape = {
  /** 0 */
  none: "0px",
  /** 4 */
  xs: "4px",
  /** 8 */
  sm: "8px",
  /** 12 */
  md: "12px",
  /** 16 */
  lg: "16px",
  /** 28 */
  xl: "28px",
  /** 50% (pill) */
  full: "9999px",
} as const;

export type ShapeKey = keyof typeof shape;

export const zIndex = {
  base: "0",
  raised: "10",
  floating: "20",
  overlay: "30",
  modal: "40",
  toast: "50",
  tooltip: "60",
} as const;

export const breakpoints = {
  /** <600 — phone */
  compact: 0,
  /** 600-839 */
  medium: 600,
  /** 840-1199 */
  expanded: 840,
  /** 1200-1599 */
  large: 1200,
  /** >=1600 */
  extraLarge: 1600,
} as const;

export const stateOpacity = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
  disabledContent: 0.38,
  disabledContainer: 0.12,
} as const;

/** Elevation level 0-5 — shadow + surface tint overlay (opacity tonal scrim) */
export const elevation = {
  level0: { shadow: "none", tint: "0%" },
  level1: { shadow: "0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)", tint: "5%" },
  level2: { shadow: "0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15)", tint: "8%" },
  level3: { shadow: "0 1px 3px rgba(0,0,0,.3), 0 4px 8px 3px rgba(0,0,0,.15)", tint: "11%" },
  level4: { shadow: "0 2px 3px rgba(0,0,0,.3), 0 6px 10px 4px rgba(0,0,0,.15)", tint: "12%" },
  level5: { shadow: "0 4px 4px rgba(0,0,0,.3), 0 8px 12px 6px rgba(0,0,0,.15)", tint: "14%" },
} as const;

export type ElevationLevel = keyof typeof elevation;

/** Durasi M3 — short/medium/long/extraLong */
export const duration = {
  short1: "50ms",
  short2: "100ms",
  short3: "150ms",
  short4: "200ms",
  medium1: "250ms",
  medium2: "300ms",
  medium3: "350ms",
  medium4: "400ms",
  long1: "450ms",
  long2: "500ms",
  long3: "550ms",
  long4: "600ms",
  extraLong1: "700ms",
  extraLong2: "800ms",
  extraLong3: "900ms",
  extraLong4: "1000ms",
} as const;

/** Easing M3 */
export const easing = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  standardAccelerate: "cubic-bezier(0.3, 0, 1, 1)",
  standardDecelerate: "cubic-bezier(0, 0, 0, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedAccelerate: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  emphasizedDecelerate: "cubic-bezier(0.05, 0.7, 0.1, 1)",
} as const;

export type TypeVariant =
  | "displayLarge"
  | "displayMedium"
  | "displaySmall"
  | "headlineLarge"
  | "headlineMedium"
  | "headlineSmall"
  | "titleLarge"
  | "titleMedium"
  | "titleSmall"
  | "labelLarge"
  | "labelMedium"
  | "labelSmall"
  | "bodyLarge"
  | "bodyMedium"
  | "bodySmall";

/** Type scale M3 — size/lineHeight/weight/letterSpacing */
export const typography: Record<
  TypeVariant,
  { fontSize: string; lineHeight: string; fontWeight: number; letterSpacing: string }
> = {
  displayLarge: { fontSize: "57px", lineHeight: "64px", fontWeight: 400, letterSpacing: "-0.25px" },
  displayMedium: { fontSize: "45px", lineHeight: "52px", fontWeight: 400, letterSpacing: "0px" },
  displaySmall: { fontSize: "36px", lineHeight: "44px", fontWeight: 400, letterSpacing: "0px" },
  headlineLarge: { fontSize: "32px", lineHeight: "40px", fontWeight: 400, letterSpacing: "0px" },
  headlineMedium: { fontSize: "28px", lineHeight: "36px", fontWeight: 400, letterSpacing: "0px" },
  headlineSmall: { fontSize: "24px", lineHeight: "32px", fontWeight: 400, letterSpacing: "0px" },
  titleLarge: { fontSize: "22px", lineHeight: "28px", fontWeight: 400, letterSpacing: "0px" },
  titleMedium: { fontSize: "16px", lineHeight: "24px", fontWeight: 500, letterSpacing: "0.15px" },
  titleSmall: { fontSize: "14px", lineHeight: "20px", fontWeight: 500, letterSpacing: "0.1px" },
  labelLarge: { fontSize: "14px", lineHeight: "20px", fontWeight: 500, letterSpacing: "0.1px" },
  labelMedium: { fontSize: "12px", lineHeight: "16px", fontWeight: 500, letterSpacing: "0.5px" },
  labelSmall: { fontSize: "11px", lineHeight: "16px", fontWeight: 500, letterSpacing: "0.5px" },
  bodyLarge: { fontSize: "16px", lineHeight: "24px", fontWeight: 400, letterSpacing: "0.5px" },
  bodyMedium: { fontSize: "14px", lineHeight: "20px", fontWeight: 400, letterSpacing: "0.25px" },
  bodySmall: { fontSize: "12px", lineHeight: "16px", fontWeight: 400, letterSpacing: "0.4px" },
};
