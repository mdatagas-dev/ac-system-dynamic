"use client";

/**
 * VM3 StateLayer — overlay state M3 (hover 8%, focus 12%, pressed 12%).
 * Diletakkan sebagai anak pertama elemen .vm3-interactive.
 * Warna mengikuti currentColor elemen induk ("on-container" role).
 */
import { cn } from "@/design-system/utilities/cn";

export function StateLayer({ className }: { className?: string }) {
  return <span aria-hidden className={cn("vm3-state-layer", className)} />;
}
