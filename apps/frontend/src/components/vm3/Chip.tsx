"use client";

/**
 * VM3 Chip — assist/filter/input/suggestion.
 * Filter: checkbox internal, tampil check saat terpilih.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";

export type ChipVariant = "assist" | "filter" | "input" | "suggestion";

export interface ChipProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant;
  icon?: string;
  selected?: boolean;
  onCheckedChange?: (selected: boolean) => void;
  trailingIcon?: string;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ variant = "assist", icon, selected, onCheckedChange, trailingIcon, className, children, onClick, ...rest }, ref) => {
    const isFilter = variant === "filter";
    return (
      <button
        ref={ref}
        type="button"
        className={cn("vm3-interactive vm3-chip", `vm3-chip-${variant}`, className)}
        aria-pressed={isFilter ? selected : undefined}
        onClick={(e) => {
          if (isFilter && onCheckedChange) onCheckedChange(!selected);
          onClick?.(e);
        }}
        {...rest}
      >
        <StateLayer />
        {isFilter && (
          <span className="material-symbols-rounded vm3-chip-check" aria-hidden>
            check
          </span>
        )}
        {icon && (
          <span className="material-symbols-rounded vm3-chip-icon" aria-hidden>
            {icon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span className="material-symbols-rounded vm3-chip-icon" aria-hidden>
            {trailingIcon}
          </span>
        )}
      </button>
    );
  },
);
Chip.displayName = "Chip";
