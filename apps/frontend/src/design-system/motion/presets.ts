/**
 * VM3 Motion Presets — varian enter/exit + layout untuk Motion.
 * Setiap animasi menjawab: dari mana? ke mana? apa yang berubah?
 * Hormati prefers-reduced-motion via useReducedMotion di komponen.
 */
import type { Variants, Transition } from "motion/react";
import { motionDuration, motionEasing } from "./tokens";

/** "250ms" → 0.25 (Motion butuh detik) */
export function sec(ms: string): number {
  return parseInt(ms, 10) / 1000;
}

/** "cubic-bezier(0.2,0,0,1)" → [0.2,0,0,1] */
export function bezier(css: string): [number, number, number, number] {
  const m = css.match(/cubic-bezier\(([^)]+)\)/);
  if (!m) return [0.2, 0, 0, 1];
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  return [parts[0], parts[1], parts[2], parts[3]];
}

const t = (
  ms: string,
  e: keyof typeof motionEasing,
): Transition => ({
  duration: sec(ms),
  ease: bezier(motionEasing[e]),
});

/** Fade — elemen muncul/menghilang dengan opacity */
export const fade: Variants = {
  initial: { opacity: 0, transition: t(motionDuration.short2, "standard") },
  animate: { opacity: 1, transition: t(motionDuration.short4, "standard") },
  exit: { opacity: 0, transition: t(motionDuration.short2, "standard") },
};

/** Slide naik — elemen datang dari bawah (bottom sheet, snackbar) */
export const slideUp: Variants = {
  initial: { opacity: 0, y: 24, transition: t(motionDuration.medium2, "emphasizedDecelerate") },
  animate: { opacity: 1, y: 0, transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  exit: { opacity: 0, y: 24, transition: t(motionDuration.short3, "emphasizedAccelerate") },
};

/** Slide turun — dialog dari atas */
export const slideDown: Variants = {
  initial: { opacity: 0, y: -24, transition: t(motionDuration.medium2, "emphasizedDecelerate") },
  animate: { opacity: 1, y: 0, transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  exit: { opacity: 0, y: -24, transition: t(motionDuration.short3, "emphasizedAccelerate") },
};

/** Slide kiri — drawer kiri masuk */
export const slideLeft: Variants = {
  initial: { opacity: 1, x: "-100%", transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  animate: { opacity: 1, x: 0, transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  exit: { opacity: 1, x: "-100%", transition: t(motionDuration.medium2, "emphasizedAccelerate") },
};

/** Slide kanan — panel kanan masuk */
export const slideRight: Variants = {
  initial: { opacity: 1, x: "100%", transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  animate: { opacity: 1, x: 0, transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  exit: { opacity: 1, x: "100%", transition: t(motionDuration.medium2, "emphasizedAccelerate") },
};

/** Scale — dialog membesar dari titik awal */
export const scale: Variants = {
  initial: { opacity: 0, scale: 0.9, transition: t(motionDuration.medium2, "emphasizedDecelerate") },
  animate: { opacity: 1, scale: 1, transition: t(motionDuration.medium3, "emphasizedDecelerate") },
  exit: { opacity: 0, scale: 0.9, transition: t(motionDuration.short3, "emphasizedAccelerate") },
};

/** Scale kecil — menu/popover */
export const scaleSmall: Variants = {
  initial: { opacity: 0, scale: 0.95, y: -4, transition: t(motionDuration.short3, "standardDecelerate") },
  animate: { opacity: 1, scale: 1, y: 0, transition: t(motionDuration.short4, "standardDecelerate") },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: t(motionDuration.short3, "standardAccelerate") },
};

/** Container + stagger — list masuk berurutan (pakai: variants + initial="hidden" animate="show") */
export const container = (staggerChildren = 0.05, delayChildren = 0): Variants => ({
  hidden: { transition: { staggerChildren: 0, staggerDirection: 1 } },
  show: { transition: { staggerChildren, delayChildren } },
});

/** Item tunggal dalam container stagger */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: t(motionDuration.medium1, "emphasizedDecelerate"),
  },
  exit: { opacity: 0, y: -8 },
};

/** Layout transition — elemen pindah posisi (shared layout) */
export const layoutTransition = {
  layout: true,
  transition: t(motionDuration.medium2, "emphasizedDecelerate"),
} as const;

/** Shared axis — konten berganti dengan slide */
export const sharedAxisX: Variants = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};
