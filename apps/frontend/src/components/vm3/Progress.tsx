"use client";

/**
 * VM3 Progress — linear/circular (determinate + indeterminate) + LoadingIndicator.
 */
import { cn } from "@/design-system/utilities/cn";

/* ---------- Linear ---------- */
export interface LinearProgressProps {
  value?: number; // 0-100; undefined = indeterminate
  className?: string;
  label?: string;
}

export function LinearProgress({ value, className, label }: LinearProgressProps) {
  const indeterminate = value == null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
      className={cn("vm3-linear", indeterminate && "vm3-linear-indeterminate", className)}
    >
      <div
        className="vm3-linear-indicator"
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
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
      className={cn("vm3-circular", indeterminate && "vm3-circular-indeterminate", className)}
    >
      <circle
        className="vm3-circular-track"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
      />
      <circle
        className="vm3-circular-indicator"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={indeterminate ? 89 : offset}
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
    <div className={cn("vm3-loading", className)}>
      <CircularProgress label={text ?? "Memuat"} />
      {text && <span>{text}</span>}
    </div>
  );
}
