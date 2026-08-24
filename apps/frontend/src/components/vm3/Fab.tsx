"use client";

/**
 * VM3 FAB — Floating Action Button (M3: primary-container, elevasi 3).
 * - Bentuk: bulat (default) atau extended (label + ikon)
 * - Ukuran: regular (56) / small (40)
 * - Elevasi 3 → naik ke 4 saat hover (spatial response)
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/design-system/utilities/cn";
import { StateLayer } from "@/components/primitives/StateLayer";
import { FocusRing } from "@/components/primitives/FocusRing";

export interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  /** label → mode extended */
  label?: string;
  small?: boolean;
}

export const Fab = forwardRef<HTMLButtonElement, FabProps>(
  ({ icon, label, small, className, disabled, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "vm3-interactive vm3-fab",
        small && "vm3-fab-small",
        label && "vm3-fab-extended",
        disabled && "vm3-disabled",
        className,
      )}
      disabled={disabled}
      {...rest}
    >
      <StateLayer />
      <FocusRing />
      <span className="material-symbols-rounded" aria-hidden>
        {icon}
      </span>
      {label && <span className="vm3-fab-label">{label}</span>}
    </button>
  ),
);
Fab.displayName = "Fab";
