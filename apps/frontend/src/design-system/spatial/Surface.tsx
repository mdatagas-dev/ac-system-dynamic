"use client";

/**
 * VM3 Surface — primitif spasial dasar. Semua komponen VM3 dibangun di atasnya.
 * - Level kedalaman (base/raised/floating/overlay/modal) → elevasi + tint + z-index
 * - Surface tint overlay: primary dicampur halus → kedalaman M3
 * - Respons dinamis (opsional): hover naik satu level, pressed turun satu level
 */
import { forwardRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { depthLevels, depthSpec, type DepthLevel } from "./depth";
import { useVm3ReducedMotion } from "@/hooks/useVm3ReducedMotion";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** level kedalaman — default raised */
  depth?: DepthLevel;
  /** warna latar — default var(--vm3-color-surface) */
  color?: string;
  /** respons dinamis: hover naik, pressed turun */
  interactive?: boolean;
  /** nonaktifkan transisi */
  noAnimate?: boolean;
}

const elevationVar = (level: DepthLevel) =>
  `var(--vm3-elevation-${depthSpec[level].elevation.slice(-1)}-shadow)`;

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  (
    { depth = "raised", color, interactive = false, noAnimate = false, style, children, ...rest },
    ref,
  ) => {
    const reduced = useVm3ReducedMotion();
    const [hover, setHover] = useState(false);
    const [press, setPress] = useState(false);

    const idx = depthLevels.indexOf(depth);
    const effective: DepthLevel = interactive
      ? press
        ? depthLevels[Math.max(0, idx - 1)]
        : hover
          ? depthLevels[Math.min(depthLevels.length - 1, idx + 1)]
          : depth
      : depth;

    const eff = depthSpec[effective];
    const tintEnabled = depthSpec[depth].tint;
    const cssVars = {
      "--vm3-surface-elevation": elevationVar(effective),
      "--vm3-surface-tint-color": tintEnabled ? "var(--vm3-color-primary)" : "transparent",
      "--vm3-surface-tint-opacity": tintEnabled ? "0.05" : "0",
    } as CSSProperties;

    return (
      <div
        ref={ref}
        {...rest}
        style={{
          position: "relative",
          zIndex: `var(--vm3-z-${eff.zIndex})`,
          background: color ?? "var(--vm3-color-surface)",
          boxShadow: "var(--vm3-surface-elevation)",
          borderRadius: "var(--vm3-shape-md)",
          transition:
            noAnimate || reduced
              ? "none"
              : "box-shadow var(--vm3-duration-short4) var(--vm3-easing-standard)",
          ...cssVars,
          ...style,
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          setPress(false);
        }}
        onMouseDown={() => setPress(true)}
        onMouseUp={() => setPress(false)}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            background:
              "linear-gradient(var(--vm3-surface-tint-color), var(--vm3-surface-tint-color))",
            opacity: "var(--vm3-surface-tint-opacity)",
          }}
        />
        <div style={{ position: "relative" }}>{children}</div>
      </div>
    );
  },
);
Surface.displayName = "Surface";
