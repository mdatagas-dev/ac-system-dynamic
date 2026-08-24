/**
 * VM3 Motion Tokens — easing + duration M3.
 * Presets berbasis Motion (framer) dibangun di presets.ts.
 */
import { duration, easing } from "@/design-system/tokens/core";

export const motionDuration = duration;
export const motionEasing = easing;

/** Durasi + easing umum per kasus interaksi M3 */
export const motionPreset = {
  /** State layer: hover/press/focus */
  stateLayer: { duration: duration.short3, easing: easing.standard },
  /** Elevasi: naik/turun shadow */
  elevation: { duration: duration.short4, easing: easing.standard },
  /** Dialog/bottom sheet muncul */
  dialogEnter: { duration: duration.long1, easing: easing.emphasizedDecelerate },
  dialogExit: { duration: duration.short3, easing: easing.emphasizedAccelerate },
  /** Drawer */
  drawerEnter: { duration: duration.medium3, easing: easing.emphasizedDecelerate },
  drawerExit: { duration: duration.medium2, easing: easing.emphasizedAccelerate },
  /** Snackbar */
  snackbar: { duration: duration.medium2, easing: easing.emphasizedDecelerate },
  /** Menu/popover kecil */
  popover: { duration: duration.short4, easing: easing.standardDecelerate },
  /** Halaman berpindah */
  page: { duration: duration.medium4, easing: easing.emphasizedDecelerate },
} as const;

/** Motion spring presets */
export const springs = {
  /** ringan: chip, badge */
  gentle: { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.6 },
  /** default: kartu, list */
  standard: { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.8 },
  /** besar: dialog, sheet */
  heavy: { type: "spring" as const, stiffness: 260, damping: 26, mass: 1 },
} as const;
