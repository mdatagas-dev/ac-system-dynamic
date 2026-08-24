"use client";

/**
 * VM3 Reduced Motion — pengguna prefers-reduced-motion dapatkan varian tanpa animasi.
 * Dipakai bersama presets motion.
 */
import { useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

export function useVm3ReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

/** Set semua transition varians → durasi 0 (reduced motion) */
export function withReducedMotion(
  variants: Variants,
  reduced: boolean,
): Variants {
  if (!reduced) return variants;
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const next: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(o)) {
        if (k === "transition") {
          next[k] = { duration: 0 };
        } else {
          next[k] = strip(val);
        }
      }
      return next;
    }
    return v;
  };
  return strip(variants) as Variants;
}
