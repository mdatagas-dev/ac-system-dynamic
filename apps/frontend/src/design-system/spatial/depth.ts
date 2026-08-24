/**
 * VM3 Spatial System — kedalaman fisik antarmuka.
 * Base → Raised → Floating → Overlay → Modal.
 * Setiap level terasa di atas level sebelumnya (elevasi + tint + z-index).
 */
import type { ElevationLevel } from "@/design-system/tokens/core";

/** Level kedalaman — urutan dari paling rendah */
export const depthLevels = [
  "base",
  "raised",
  "floating",
  "overlay",
  "modal",
] as const;

export type DepthLevel = (typeof depthLevels)[number];

export interface DepthSpec {
  /** level elevasi M3 (0-5) */
  elevation: ElevationLevel;
  /** z-index token */
  zIndex: "base" | "raised" | "floating" | "overlay" | "modal";
  /** apakah memakai surface tint overlay */
  tint: boolean;
  /** perspektif 3D halus (0 = tidak ada) */
  perspective?: string;
}

/** Peta level → spec. Elevasi naik bertahap = kedalaman terasa fisik. */
export const depthSpec: Record<DepthLevel, DepthSpec> = {
  base: { elevation: "level0", zIndex: "base", tint: false },
  raised: { elevation: "level1", zIndex: "raised", tint: true },
  floating: { elevation: "level3", zIndex: "floating", tint: true },
  overlay: { elevation: "level4", zIndex: "overlay", tint: true },
  modal: { elevation: "level5", zIndex: "modal", tint: true },
};
