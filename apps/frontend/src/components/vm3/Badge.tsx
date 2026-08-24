"use client";

/**
 * VM3 Badge — counter kecil atau dot indikator.
 */
import { cn } from "@/design-system/utilities/cn";

export interface BadgeProps {
  count?: number;
  dot?: boolean;
  max?: number;
  className?: string;
}

export function Badge({ count, dot, max = 99, className }: BadgeProps) {
  const label = count == null ? undefined : count > max ? `${max}+` : String(count);
  if (dot) {
    return <span className={cn("vm3-badge vm3-badge-dot", className)} aria-hidden />;
  }
  return <span className={cn("vm3-badge", className)}>{label}</span>;
}
