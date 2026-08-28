"use client";

/**
 * VM3 Chip — shadcn/ui Button. assist→secondary, suggestion→ghost,
 * filter→outline/default, input→outline.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Button as ShadButton } from "@/components/ui/button";

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
      <ShadButton
        ref={ref}
        type="button"
        variant={
          isFilter && selected ? "default" : variant === "assist" ? "secondary" : variant === "suggestion" ? "ghost" : "outline"
        }
        aria-pressed={isFilter ? selected : undefined}
        onClick={(e) => {
          if (isFilter && onCheckedChange) onCheckedChange(!selected);
          onClick?.(e);
        }}
        className={cn("gap-1.5 rounded-full", className)}
        {...rest}
      >
        {isFilter && (
          <span className="material-symbols-rounded text-sm" aria-hidden>
            check
          </span>
        )}
        {icon && (
          <span className="material-symbols-rounded text-sm" aria-hidden>
            {icon}
          </span>
        )}
        {children}
        {trailingIcon && (
          <span className="material-symbols-rounded text-sm" aria-hidden>
            {trailingIcon}
          </span>
        )}
      </ShadButton>
    );
  },
);
Chip.displayName = "Chip";