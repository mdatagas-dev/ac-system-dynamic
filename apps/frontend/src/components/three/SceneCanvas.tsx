"use client";

/**
 * SceneCanvas — wrapper Canvas R3F untuk scene dekoratif VM3.
 * - dpr [1, 2], alpha transparan (latar dari token surface di belakangnya)
 * - pause otomatis saat tab hidden → frameloop "never"
 * - prefers-reduced-motion → "demand" (render satu frame statis)
 * - aria-hidden + pointer-events-none: scene murni dekoratif, parallax via window listener
 */
import { Canvas } from "@react-three/fiber";
import { useEffect, useState, type ReactNode } from "react";
import { useVm3ReducedMotion } from "@/hooks/useVm3ReducedMotion";
import { cn } from "@/design-system/utilities/cn";

export interface SceneCanvasProps {
  children: ReactNode;
  className?: string;
  cameraPosition?: [number, number, number];
  fov?: number;
  /** "always" = animasi kontinyu (hero); "demand" = mode hemat (ambient, throttle internal) */
  loop?: "always" | "demand";
}

export function SceneCanvas({
  children,
  className,
  cameraPosition = [0, 0.35, 7],
  fov = 44,
  loop = "always",
}: SceneCanvasProps) {
  const reduced = useVm3ReducedMotion();
  const [hiddenTab, setHiddenTab] = useState(false);

  useEffect(() => {
    const onVisibility = () => setHiddenTab(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const frameloop = hiddenTab ? ("never" as const) : reduced ? ("demand" as const) : loop;

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden="true">
      <Canvas
        frameloop={frameloop}
        dpr={[1, 2]}
        camera={{ position: cameraPosition, fov }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        {children}
      </Canvas>
    </div>
  );
}
