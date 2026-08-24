/**
 * VM3 Semantic Color Roles — daftar lengkap per M3 (material-color-utilities Scheme).
 * Satu sumber kebenaran: dipakai runtime (generate) DAN script generate CSS statis.
 */

export const colorRoles = [
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondary",
  "onSecondary",
  "secondaryContainer",
  "onSecondaryContainer",
  "tertiary",
  "onTertiary",
  "tertiaryContainer",
  "onTertiaryContainer",
  "error",
  "onError",
  "errorContainer",
  "onErrorContainer",
  "surfaceDim",
  "surface",
  "surfaceBright",
  "surfaceContainerLowest",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "surfaceContainerHighest",
  "onSurface",
  "surfaceVariant",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
  "shadow",
  "scrim",
  "surfaceTint",
] as const;

export type ColorRole = (typeof colorRoles)[number];

/** camelCase → kebab-case CSS variable: onPrimaryContainer → --vm3-color-on-primary-container */
export function roleToVar(role: ColorRole): string {
  return `--vm3-color-${role.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`;
}
