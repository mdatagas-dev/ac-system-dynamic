"use client";

/**
 * VM3 Progress — LinearProgress pakai shadcn/ui Progress.
 * CircularProgress & LoadingIndicator: tidak ada padanan shadcn, tetap custom SVG.
 */
import { cn } from "@/lib/utils";
import { Progress as ShadProgress } from "@/components/ui/progress";

/* ---------- Linear ---------- */
export interface LinearProgressProps {
  value?: number; // 0-100; undefined = indeterminate
  className?: string;
  label?: string;
}

export function LinearProgress({ value, className, label }: LinearProgressProps) {
  if (value == null) {
    // indeterminate — animasi pulse
    return (
      <div
        role="progressbar"
        aria-label={label}
        className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      >
        <div className="absolute inset-y-0 w-1/3 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }
  return (
    <ShadProgress
      value={Math.max(0, Math.min(100, value))}
      aria-label={label}
      className={cn(className)}
    />
  );
}

/* ---------- Circular ---------- */
export interface CircularProgressProps {
  value?: number; // 0-100; undefined = indeterminate
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function CircularProgress({
  value,
  size = 40,
  strokeWidth = 4,
  label,
  className,
}: CircularProgressProps) {
  const indeterminate = value == null;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = indeterminate ? 0 : c * (1 - Math.max(0, Math.min(100, value)) / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
      className={cn(indeterminate && "animate-spin", className)}
    >
      <circle
        className="stroke-muted"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
      />
      <circle
        className="stroke-primary"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={indeterminate ? c * 0.75 : offset}
      />
    </svg>
  );
}

/* ---------- LoadingIndicator ---------- */
export interface LoadingIndicatorProps {
  text?: string;
  className?: string;
}

export function LoadingIndicator({ text, className }: LoadingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-3 text-sm text-muted-foreground", className)}>
      <CircularProgress label={text ?? "Memuat"} />
      {text && <span>{text}</span>}
    </div>
  );
}
