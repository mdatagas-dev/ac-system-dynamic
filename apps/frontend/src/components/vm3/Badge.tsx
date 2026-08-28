"use client";

/**
 * VM3 Badge — shadcn/ui Badge. Counter / dot indikator.
 */
import { cn } from "@/lib/utils";
import { Badge as ShadBadge } from "@/components/ui/badge";

export interface BadgeProps {
  count?: number;
  dot?: boolean;
  max?: number;
  className?: string;
}

export function Badge({ count, dot, max = 99, className }: BadgeProps) {
  if (dot) {
    return <span className={cn("size-2.5 rounded-full bg-primary", className)} aria-hidden />;
  }
  const label = count == null ? undefined : count > max ? `${max}+` : String(count);
  return (
    <ShadBadge variant="secondary" className={cn("min-w-5 justify-center", className)}>
      {label}
    </ShadBadge>
  );
}
