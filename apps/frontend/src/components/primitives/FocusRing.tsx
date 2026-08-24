"use client";

/**
 * VM3 FocusRing — indikator fokus keyboard (inset ring).
 * Diletakkan di dalam elemen .vm3-interactive; tampil saat :focus-visible.
 */
import { cn } from "@/design-system/utilities/cn";

export function FocusRing({ className }: { className?: string }) {
  return <span aria-hidden className={cn("vm3-focus-ring", className)} />;
}
